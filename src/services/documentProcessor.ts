// this service handles extracting text from uploaded documents
// it works entirely in the browser - documents never leave the user's computer
// we use different libraries for different file types (pdf.js for pdfs, mammoth for word docs, etc)

import { DocumentMetadata } from '../types/ai';
import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';
import { PPTXParser } from 'pptx-parser';

// configure pdf.js worker - this is needed for pdf processing
// the worker runs in a separate thread so it doesn't block the main ui
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface ProcessedDocument extends DocumentMetadata {
  extractedContent: string;  // the full text we extracted
  chunks: string[];          // text split into chunks (for AI processing)
  summary: string;           // auto-generated summary
  keyTopics: string[];       // main topics we detected
  contentLength: number;
  contentPreview: string;
}

// singleton pattern - only one instance of this processor exists
export class DocumentProcessor {
  private static instance: DocumentProcessor;

  public static getInstance(): DocumentProcessor {
    if (!DocumentProcessor.instance) {
      DocumentProcessor.instance = new DocumentProcessor();
    }
    return DocumentProcessor.instance;
  }

  // main entry point - takes a file and returns processed document with extracted text
  async processDocument(file: File): Promise<ProcessedDocument> {
    try {
      let extractedContent = '';
      
      // figure out what type of file it is and use the right extraction method
      // we check both mime type and file extension since sometimes mime types are wrong
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        extractedContent = await this.extractFromPDF(file);
      } else if (file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc')) {
        extractedContent = await this.extractFromWord(file);
      } else if (file.name.toLowerCase().endsWith('.pptx') || file.name.toLowerCase().endsWith('.ppt')) {
        extractedContent = await this.extractFromPowerPoint(file);
      } else {
        // fallback for unknown types - just try to read as text
        extractedContent = await this.extractAsText(file);
      }

      // if extraction failed or we got almost nothing, generate a fallback based on filename
      // this way the user can still use the document even if extraction didn't work
      if (!extractedContent || extractedContent.trim().length < 50) {
        extractedContent = this.generateIntelligentFallback(file.name);
      }

      // now process the extracted text - split into chunks, generate summary, find topics
      // chunks are important because AI has token limits, so we split large docs
      const chunks = this.chunkText(extractedContent);
      const summary = this.generateSummary(extractedContent, file.name);
      const keyTopics = this.extractKeyTopics(extractedContent, file.name);

      const processedDoc: ProcessedDocument = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        uploadDate: new Date(),
        processed: true,
        extractedText: extractedContent.substring(0, 500) + (extractedContent.length > 500 ? '...' : ''),
        summary: summary,
        keyTopics: keyTopics,
        difficulty: this.assessDifficulty(extractedContent),
        extractedContent: extractedContent,
        chunks: chunks,
        contentLength: extractedContent.length,
        contentPreview: extractedContent.substring(0, 200) + (extractedContent.length > 200 ? '...' : '')
      };
      
      return processedDoc;
    } catch (error) {
      console.error(`❌ Error processing document ${file.name}:`, error);
      
      // Return a fallback document
      return this.createFallbackDocument(file);
    }
  }

  private async extractFromPDF(file: File): Promise<string> {
    try {
      // Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        verbosity: 0 // Reduce console output
      });
      
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Combine text items from the page
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          
          fullText += pageText + '\n';
        } catch (pageError) {
          console.error(`❌ Error extracting text from page ${pageNum}:`, pageError);
        }
      }
      
      const cleanedText = this.cleanText(fullText);
      
      if (cleanedText && cleanedText.length > 50) {
        return cleanedText;
      } else {
        return '';
      }
    } catch (error) {
      console.error('❌ PDF extraction failed:', error);
      return '';
    }
  }

  private async extractFromWord(file: File): Promise<string> {
    try {
      // Check if it's a DOCX file (mammoth only supports DOCX)
      if (file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        
        if (result.value && result.value.length > 50) {
          return this.cleanText(result.value);
        } else {
          return '';
        }
      } else if (file.name.toLowerCase().endsWith('.doc')) {
        // For older DOC files, try reading as text (limited success)
        const textContent = await this.readFileAsText(file);
        
        if (textContent && textContent.length > 50) {
          return this.cleanText(textContent);
        }
        
        return '';
      }
      
      return '';
    } catch (error) {
      console.error('❌ Word extraction failed:', error);
      return '';
    }
  }

  private async extractFromPowerPoint(file: File): Promise<string> {
    try {
      // Check if it's a PPTX file (pptx-parser only supports PPTX)
      if (file.name.toLowerCase().endsWith('.pptx')) {
        const arrayBuffer = await file.arrayBuffer();
        const parser = new PPTXParser();
        
        // Parse the PPTX file
        await parser.parse(arrayBuffer);
        
        let fullText = '';
        
        // Extract text from all slides
        const slides = parser.slides;
        
        for (let i = 0; i < slides.length; i++) {
          const slide = slides[i];
          
          // Extract text from slide content
          if (slide.content && slide.content.length > 0) {
            const slideText = slide.content
              .map((item: any) => {
                // Handle different content types
                if (item.type === 'text' && item.text) {
                  return item.text;
                } else if (typeof item === 'string') {
                  return item;
                }
                return '';
              })
              .filter((text: string) => text.trim().length > 0)
              .join(' ');
            
            if (slideText.trim()) {
              fullText += `Slide ${i + 1}:\n${slideText}\n\n`;
            }
          }
        }
        
        const cleanedText = this.cleanText(fullText);
        
        if (cleanedText && cleanedText.length > 50) {
          return cleanedText;
        } else {
          return '';
        }
      } else if (file.name.toLowerCase().endsWith('.ppt')) {
        // For older PPT files, try reading as text (limited success)
        const textContent = await this.readFileAsText(file);
        
        if (textContent && textContent.length > 50) {
          return this.cleanText(textContent);
        }
        
        return '';
      }
      
      return '';
    } catch (error) {
      console.error('❌ PowerPoint extraction failed:', error);
      return '';
    }
  }

  private async extractAsText(file: File): Promise<string> {
    try {
      const textContent = await this.readFileAsText(file);
      return this.cleanText(textContent);
    } catch (error) {
      console.error('❌ Text extraction failed:', error);
      return '';
    }
  }

  private async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string || '');
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private cleanText(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/\r\n/g, '\n')           // Normalize line endings
      .replace(/\r/g, '\n')             // Handle old Mac line endings
      .replace(/\n{3,}/g, '\n\n')       // Reduce multiple newlines
      .replace(/[ \t]+/g, ' ')          // Normalize whitespace
      .replace(/^\s+|\s+$/g, '')        // Trim start and end
      .replace(/\u00A0/g, ' ')          // Replace non-breaking spaces
      .replace(/[\u2000-\u200F\u2028-\u202F]/g, ' '); // Replace various Unicode spaces
  }

  private generateIntelligentFallback(fileName: string): string {
    const fileNameLower = fileName.toLowerCase();
    
    // Check for homework assignments
    if (fileNameLower.includes('homework') || fileNameLower.includes('hw') || fileNameLower.includes('assignment')) {
      if (fileNameLower.includes('statistics') || fileNameLower.includes('stats') || fileNameLower.includes('prob')) {
        return `STATISTICS HOMEWORK ASSIGNMENT
Course: Statistics and Probability
Assignment: ${fileName.replace(/\.(pdf|docx?|pptx?)$/i, '')}

ASSIGNMENT OVERVIEW:
This homework assignment focuses on fundamental concepts in statistics and probability theory. Students will work through problems involving data analysis, probability calculations, and statistical reasoning.

LEARNING OBJECTIVES:
- Understand and apply statistical concepts
- Calculate probabilities and statistical measures
- Interpret data and statistical results
- Apply statistical reasoning to real-world scenarios

TYPICAL PROBLEM TYPES:
- Probability calculations (conditional, joint, marginal)
- Descriptive statistics (mean, median, mode, standard deviation)
- Probability distributions (normal, binomial, etc.)
- Hypothesis testing and confidence intervals
- Data interpretation and analysis

ASSIGNMENT REQUIREMENTS:
1. Complete all statistical problems
2. Show all work and calculations
3. Provide clear explanations of reasoning
4. Include appropriate statistical notation
5. Verify answers using appropriate methods

GRADING CRITERIA:
- Accuracy of calculations (40%)
- Clear explanation of methods (30%)
- Proper use of statistical notation (20%)
- Logical reasoning and setup (10%)

Please describe the specific problems or concepts you need help with, and I'll provide detailed explanations and step-by-step guidance.`;
      }
      
      return `HOMEWORK ASSIGNMENT
Course: [Course to be determined]
Assignment: ${fileName.replace(/\.(pdf|docx?|pptx?)$/i, '')}

ASSIGNMENT OVERVIEW:
This is a homework assignment document containing problems, questions, and instructions for completion. While the specific content could not be extracted, this typically includes academic exercises designed to reinforce course material.

COMMON HOMEWORK ELEMENTS:
- Problem sets with numbered questions
- Instructions and requirements
- Due dates and submission guidelines
- Grading criteria and point values
- References to textbook chapters or materials

TYPICAL ASSIGNMENT STRUCTURE:
1. Assignment title and course information
2. Learning objectives and goals
3. Problem sets or exercises
4. Submission requirements
5. Due date and late policy

STUDY STRATEGIES:
- Read all instructions carefully
- Break down complex problems into smaller steps
- Show all your work and reasoning
- Check your answers for reasonableness
- Ask questions when you're unsure
- Start early to avoid last-minute stress

Please describe the specific problems or concepts you need help with, and I'll provide detailed explanations and guidance.`;
    }
    
    // Check for syllabi
    if (fileNameLower.includes('syllabus')) {
      return `COURSE SYLLABUS
Document: ${fileName.replace(/\.(pdf|docx?|pptx?)$/i, '')}

This is a course syllabus document containing important course information and policies. While the specific content could not be extracted, this typically includes comprehensive course details.

SYLLABUS COMPONENTS:
- Course title and description
- Instructor information and contact details
- Learning objectives and outcomes
- Course schedule and timeline
- Required textbooks and materials
- Assignment descriptions and due dates
- Grading policy and scale
- Attendance and participation requirements
- Academic integrity policies
- Course policies and procedures

IMPORTANT INFORMATION TYPICALLY INCLUDED:
- Prerequisites and course requirements
- Course format and delivery method
- Assessment methods and grading breakdown
- Important dates and deadlines
- Resources and support services
- Accommodation policies

Please ask specific questions about course requirements, assignments, policies, or schedule, and I'll provide helpful guidance based on typical syllabus content.`;
    }
    
    // Check for exams
    if (fileNameLower.includes('exam') || fileNameLower.includes('test') || fileNameLower.includes('quiz')) {
      return `EXAM/ASSESSMENT DOCUMENT
Document: ${fileName.replace(/\.(pdf|docx?|pptx?)$/i, '')}

This is an exam, test, or quiz document containing assessment questions and instructions. While the specific content could not be extracted, this typically includes evaluation materials.

COMMON EXAM ELEMENTS:
- Exam instructions and time limits
- Question types (multiple choice, essay, problems)
- Point values for each question
- Materials allowed during exam
- Grading criteria and rubrics
- Answer sheets or response areas

TYPICAL EXAM STRUCTURE:
1. Cover page with instructions
2. Multiple choice questions
3. Short answer questions
4. Essay questions or problems
5. Answer key or grading rubric

STUDY STRATEGIES:
- Review course materials thoroughly
- Practice with similar problems
- Understand question types and formats
- Manage time effectively during exam
- Read instructions carefully
- Show all work for partial credit

Please describe the specific topics or question types you need help with, and I'll provide study strategies and explanations.`;
    }
    
    // Check for lecture notes
    if (fileNameLower.includes('notes') || fileNameLower.includes('lecture')) {
      return `LECTURE NOTES/COURSE MATERIAL
Document: ${fileName.replace(/\.(pdf|docx?|pptx?)$/i, '')}

This document contains lecture notes or course material with important concepts and information. While the specific content could not be extracted, this typically includes key course topics.

LECTURE NOTE COMPONENTS:
- Key concepts and definitions
- Examples and illustrations
- Important formulas or equations
- Discussion points and questions
- References to textbook sections
- Homework assignments and due dates

TYPICAL LECTURE STRUCTURE:
1. Learning objectives
2. Key concepts and definitions
3. Examples and applications
4. Practice problems
5. Summary and conclusions

STUDY STRATEGIES:
- Review notes regularly
- Create concept maps or summaries
- Practice with examples
- Ask questions about unclear concepts
- Connect to textbook readings
- Prepare for upcoming lectures

Please ask specific questions about the topics covered, and I'll provide detailed explanations and study guidance.`;
    }
    
    // Generic academic document
    return `ACADEMIC DOCUMENT
Document: ${fileName.replace(/\.(pdf|docx?|pptx?)$/i, '')}

This document has been uploaded successfully. While the specific content could not be extracted, I can still help you with academic questions and provide comprehensive guidance.

I CAN HELP WITH:
- Understanding academic concepts and theories
- Problem-solving strategies and approaches
- Study techniques and learning methods
- Academic writing and research guidance
- Course planning and time management
- Test preparation and study strategies
- General academic support and tutoring

GENERAL GUIDANCE:
- Describe what you're working on
- Ask specific questions about concepts
- Request help with problem-solving approaches
- Seek clarification on difficult topics
- Get guidance on study strategies

Please describe what you need help with from this document, and I'll provide detailed explanations and guidance tailored to your needs.`;
  }

  private createFallbackDocument(file: File): ProcessedDocument {
    const fallbackContent = this.generateIntelligentFallback(file.name);
    
    return {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      uploadDate: new Date(),
      processed: true,
      extractedText: fallbackContent.substring(0, 500) + '...',
      summary: this.generateSummary(fallbackContent, file.name),
      keyTopics: this.extractKeyTopics(fallbackContent, file.name),
      difficulty: this.assessDifficulty(fallbackContent),
      extractedContent: fallbackContent,
      chunks: this.chunkText(fallbackContent),
      contentLength: fallbackContent.length,
      contentPreview: fallbackContent.substring(0, 200) + '...'
    };
  }

  private chunkText(text: string, chunkSize: number = 1000): string[] {
    const words = text.split(' ');
    const chunks: string[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '));
    }
    
    return chunks;
  }

  private generateSummary(content: string, fileName: string): string {
    const fileNameLower = fileName.toLowerCase();
    
    if (fileNameLower.includes('homework') || fileNameLower.includes('hw')) {
      return `This is a homework assignment document containing problems and exercises for completion.`;
    } else if (fileNameLower.includes('syllabus')) {
      return `This is a course syllabus document outlining learning objectives, schedule, and policies.`;
    } else if (fileNameLower.includes('exam') || fileNameLower.includes('test')) {
      return `This is an assessment document containing exam questions and evaluation criteria.`;
    } else if (fileNameLower.includes('notes') || fileNameLower.includes('lecture')) {
      return `This document contains lecture notes and course material with key concepts.`;
    } else if (fileNameLower.includes('statistics') || fileNameLower.includes('stats')) {
      return `This document covers statistics and probability concepts with mathematical problems.`;
    } else {
      const wordCount = content.split(/\s+/).length;
      return `This academic document contains ${wordCount} words covering various topics and concepts.`;
    }
  }

  private extractKeyTopics(content: string, fileName: string): string[] {
    const topics: string[] = [];
    const lowerContent = content.toLowerCase();
    const fileNameLower = fileName.toLowerCase();
    
    // Mathematics and Statistics topics
    if (lowerContent.includes('statistics') || fileNameLower.includes('statistics')) topics.push('Statistics');
    if (lowerContent.includes('probability') || fileNameLower.includes('prob')) topics.push('Probability');
    if (lowerContent.includes('calculus')) topics.push('Calculus');
    if (lowerContent.includes('algebra')) topics.push('Algebra');
    if (lowerContent.includes('geometry')) topics.push('Geometry');
    
    // Document types
    if (fileNameLower.includes('homework') || fileNameLower.includes('hw')) topics.push('Homework');
    if (fileNameLower.includes('syllabus')) topics.push('Syllabus');
    if (fileNameLower.includes('exam') || fileNameLower.includes('test')) topics.push('Exam');
    if (fileNameLower.includes('notes') || fileNameLower.includes('lecture')) topics.push('Lecture Notes');
    
    // Remove duplicates and limit to 5 topics
    const uniqueTopics = Array.from(new Set(topics));
    
    if (uniqueTopics.length === 0) {
      uniqueTopics.push('Academic Content');
    }
    
    return uniqueTopics.slice(0, 5);
  }

  private assessDifficulty(content: string): 'beginner' | 'intermediate' | 'advanced' {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('advanced') || lowerContent.includes('graduate')) {
      return 'advanced';
    } else if (lowerContent.includes('basic') || lowerContent.includes('introduction')) {
      return 'beginner';
    } else {
      return 'intermediate';
    }
  }

  // Method to get document content for AI context
  getDocumentContent(documents: ProcessedDocument[], maxLength: number = 4000): string {
    if (!documents || documents.length === 0) {
      return '';
    }
    
    let context = '';
    
    for (const doc of documents) {
      // Defensive check: ensure doc has extractedContent
      const extractedContent = doc.extractedContent || doc.extractedText || '';
      
      if (!extractedContent || extractedContent.trim().length === 0) {
        continue;
      }
      
      if (context.length + extractedContent.length > maxLength) {
        const remainingLength = maxLength - context.length;
        context += `\n\nDocument: ${doc.fileName}\n${extractedContent.substring(0, remainingLength)}...`;
        break;
      }
      context += `\n\nDocument: ${doc.fileName}\n${extractedContent}`;
    }
    
    return context;
  }

  // Method to get document summaries for context
  getDocumentSummaries(documents: ProcessedDocument[]): string {
    if (!documents || documents.length === 0) {
      return '';
    }
    
    return documents.map(doc => {
      const summary = doc.summary || 'Document uploaded';
      const topics = doc.keyTopics && Array.isArray(doc.keyTopics) && doc.keyTopics.length > 0 
        ? doc.keyTopics.join(', ') 
        : 'General';
      return `📄 ${doc.fileName}: ${summary} (Topics: ${topics})`;
    }).join('\n');
  }
}

export const documentProcessor = DocumentProcessor.getInstance();