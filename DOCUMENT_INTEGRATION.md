# Document Integration

## Supported File Types
- **PDF**: Text extraction using PDF.js
- **DOCX**: Text extraction using Mammoth.js  
- **DOC**: Basic text extraction (limited)
- **PPTX**: Text extraction using PPTX Parser
- **PPT**: Basic text extraction (limited)

## Integration Flow
1. **Upload** → User uploads document
2. **Extract** → Text extracted from document
3. **Process** → Content analyzed and chunked
4. **Context** → Document content sent to Gemini API
5. **Response** → AI provides guidance based on document content

