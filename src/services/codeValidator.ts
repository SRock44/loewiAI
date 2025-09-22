export interface CodeValidationResult {
  isValid: boolean;
  errors: CodeError[];
  warnings: CodeWarning[];
  language: string;
}

export interface CodeError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
  rule?: string;
}

export interface CodeWarning {
  line: number;
  column: number;
  message: string;
  rule?: string;
}

export interface CodeBlock {
  language: string;
  code: string;
  startLine: number;
}

export class CodeValidator {
  private static instance: CodeValidator;

  public static getInstance(): CodeValidator {
    if (!CodeValidator.instance) {
      CodeValidator.instance = new CodeValidator();
    }
    return CodeValidator.instance;
  }

  /**
   * Validates code blocks in a message
   */
  public validateCodeBlocks(content: string): CodeValidationResult[] {
    const codeBlocks = this.extractCodeBlocks(content);
    const results: CodeValidationResult[] = [];

    for (const block of codeBlocks) {
      const result = this.validateCode(block.code, block.language);
      results.push(result);
    }

    return results;
  }

  /**
   * Extracts code blocks from message content
   */
  private extractCodeBlocks(content: string): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    let match;
    let lineNumber = 1;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();
      
      // Count lines before this code block
      const beforeCode = content.substring(0, match.index);
      const linesBefore = (beforeCode.match(/\n/g) || []).length;
      
      codeBlocks.push({
        language,
        code,
        startLine: linesBefore + 1
      });
    }

    return codeBlocks;
  }

  /**
   * Validates code for a specific language
   */
  public validateCode(code: string, language: string): CodeValidationResult {
    const result: CodeValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      language
    };

    switch (language.toLowerCase()) {
      case 'javascript':
      case 'js':
      case 'typescript':
      case 'ts':
        return this.validateJavaScript(code, result);
      case 'python':
      case 'py':
        return this.validatePython(code, result);
      case 'java':
        return this.validateJava(code, result);
      case 'c':
      case 'cpp':
      case 'c++':
        return this.validateC(code, result);
      case 'csharp':
      case 'cs':
        return this.validateCSharp(code, result);
      case 'php':
        return this.validatePHP(code, result);
      case 'ruby':
      case 'rb':
        return this.validateRuby(code, result);
      case 'go':
        return this.validateGo(code, result);
      case 'rust':
      case 'rs':
        return this.validateRust(code, result);
      case 'sql':
        return this.validateSQL(code, result);
      case 'json':
        return this.validateJSON(code, result);
      case 'css':
        return this.validateCSS(code, result);
      case 'html':
      case 'xml':
        return this.validateHTML(code, result);
      default:
        return this.validateGeneric(code, result);
    }
  }

  /**
   * JavaScript/TypeScript validation
   */
  private validateJavaScript(code: string, result: CodeValidationResult): CodeValidationResult {
    try {
      // Basic syntax validation using eval in a safe way
      new Function(code);
    } catch (error) {
      result.isValid = false;
      result.errors.push({
        line: 1,
        column: 1,
        message: `JavaScript syntax error: ${error.message}`,
        severity: 'error'
      });
    }

    // Check for common issues
    this.checkCommonIssues(code, result, 'javascript');
    return result;
  }

  /**
   * Python validation
   */
  private validatePython(code: string, result: CodeValidationResult): CodeValidationResult {
    // Check for basic Python syntax issues
    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for indentation issues
      if (line.trim() && !line.startsWith(' ') && !line.startsWith('\t') && 
          (line.includes(':') || line.includes('def ') || line.includes('class ') || line.includes('if ') || line.includes('for ') || line.includes('while '))) {
        // This might be a function/class definition that needs proper indentation
        if (i > 0 && lines[i - 1].trim().endsWith(':')) {
          result.warnings.push({
            line: lineNumber,
            column: 1,
            message: 'Potential indentation issue - Python requires consistent indentation',
            rule: 'indentation'
          });
        }
      }

      // Check for common Python syntax errors
      if (line.includes('print ') && !line.includes('print(')) {
        result.errors.push({
          line: lineNumber,
          column: line.indexOf('print ') + 1,
          message: 'Python 3 requires parentheses for print statements: print(...)',
          severity: 'error'
        });
        result.isValid = false;
      }
    }

    this.checkCommonIssues(code, result, 'python');
    return result;
  }

  /**
   * Java validation
   */
  private validateJava(code: string, result: CodeValidationResult): CodeValidationResult {
    // Check for basic Java structure
    if (!code.includes('public class') && !code.includes('class ')) {
      result.warnings.push({
        line: 1,
        column: 1,
        message: 'Java code typically requires a class definition',
        rule: 'structure'
      });
    }

    // Check for main method
    if (code.includes('public static void main') && !code.includes('String[] args')) {
      result.errors.push({
        line: 1,
        column: 1,
        message: 'Main method should have String[] args parameter',
        severity: 'error'
      });
      result.isValid = false;
    }

    this.checkCommonIssues(code, result, 'java');
    return result;
  }

  /**
   * C/C++ validation
   */
  private validateC(code: string, result: CodeValidationResult): CodeValidationResult {
    // Check for basic C structure
    if (!code.includes('#include') && !code.includes('int main')) {
      result.warnings.push({
        line: 1,
        column: 1,
        message: 'C/C++ code typically requires includes and main function',
        rule: 'structure'
      });
    }

    // Check for semicolon issues
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#') && !line.startsWith('//') && 
          !line.startsWith('/*') && !line.endsWith(';') && 
          !line.endsWith('{') && !line.endsWith('}') && 
          !line.includes('if ') && !line.includes('for ') && !line.includes('while ')) {
        result.warnings.push({
          line: i + 1,
          column: line.length,
          message: 'Missing semicolon at end of statement',
          rule: 'semicolon'
        });
      }
    }

    this.checkCommonIssues(code, result, 'c');
    return result;
  }

  /**
   * C# validation - basic validation only
   */
  private validateCSharp(code: string, result: CodeValidationResult): CodeValidationResult {
    // Only do basic common issue checks for C#
    this.checkCommonIssues(code, result, 'csharp');
    return result;
  }

  /**
   * PHP validation
   */
  private validatePHP(code: string, result: CodeValidationResult): CodeValidationResult {
    // Check for PHP opening tag
    if (!code.includes('<?php') && !code.includes('<?=')) {
      result.warnings.push({
        line: 1,
        column: 1,
        message: 'PHP code should start with <?php or <?=',
        rule: 'opening-tag'
      });
    }

    this.checkCommonIssues(code, result, 'php');
    return result;
  }

  /**
   * Ruby validation
   */
  private validateRuby(code: string, result: CodeValidationResult): CodeValidationResult {
    // Check for common Ruby issues
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('puts ') && !line.includes('puts(')) {
        result.warnings.push({
          line: i + 1,
          column: line.indexOf('puts ') + 1,
          message: 'Consider using puts() with parentheses for clarity',
          rule: 'style'
        });
      }
    }

    this.checkCommonIssues(code, result, 'ruby');
    return result;
  }

  /**
   * Go validation
   */
  private validateGo(code: string, result: CodeValidationResult): CodeValidationResult {
    // Check for package declaration
    if (!code.includes('package ')) {
      result.warnings.push({
        line: 1,
        column: 1,
        message: 'Go code should start with a package declaration',
        rule: 'package'
      });
    }

    this.checkCommonIssues(code, result, 'go');
    return result;
  }

  /**
   * Rust validation
   */
  private validateRust(code: string, result: CodeValidationResult): CodeValidationResult {
    // Check for main function
    if (!code.includes('fn main()')) {
      result.warnings.push({
        line: 1,
        column: 1,
        message: 'Rust code typically requires a main function',
        rule: 'main-function'
      });
    }

    this.checkCommonIssues(code, result, 'rust');
    return result;
  }

  /**
   * SQL validation
   */
  private validateSQL(code: string, result: CodeValidationResult): CodeValidationResult {
    // Check for basic SQL structure
    const upperCode = code.toUpperCase();
    if (!upperCode.includes('SELECT') && !upperCode.includes('INSERT') && 
        !upperCode.includes('UPDATE') && !upperCode.includes('DELETE')) {
      result.warnings.push({
        line: 1,
        column: 1,
        message: 'SQL code should contain SELECT, INSERT, UPDATE, or DELETE statements',
        rule: 'sql-statement'
      });
    }

    this.checkCommonIssues(code, result, 'sql');
    return result;
  }

  /**
   * JSON validation
   */
  private validateJSON(code: string, result: CodeValidationResult): CodeValidationResult {
    try {
      JSON.parse(code);
    } catch (error) {
      result.isValid = false;
      result.errors.push({
        line: 1,
        column: 1,
        message: `JSON syntax error: ${error.message}`,
        severity: 'error'
      });
    }

    return result;
  }

  /**
   * CSS validation
   */
  private validateCSS(code: string, result: CodeValidationResult): CodeValidationResult {
    // Check for basic CSS structure
    if (!code.includes('{') || !code.includes('}')) {
      result.warnings.push({
        line: 1,
        column: 1,
        message: 'CSS should contain selectors with curly braces',
        rule: 'css-structure'
      });
    }

    this.checkCommonIssues(code, result, 'css');
    return result;
  }

  /**
   * HTML validation
   */
  private validateHTML(code: string, result: CodeValidationResult): CodeValidationResult {
    // Check for basic HTML structure
    if (!code.includes('<') || !code.includes('>')) {
      result.warnings.push({
        line: 1,
        column: 1,
        message: 'HTML should contain tags with angle brackets',
        rule: 'html-structure'
      });
    }

    this.checkCommonIssues(code, result, 'html');
    return result;
  }

  /**
   * Generic validation for unsupported languages
   */
  private validateGeneric(code: string, result: CodeValidationResult): CodeValidationResult {
    this.checkCommonIssues(code, result, 'generic');
    return result;
  }

  /**
   * Check for common issues across all languages
   */
  private checkCommonIssues(code: string, result: CodeValidationResult, language: string): void {
    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for very long lines
      if (line.length > 120) {
        result.warnings.push({
          line: lineNumber,
          column: 121,
          message: 'Line is very long (>120 characters). Consider breaking it up.',
          rule: 'line-length'
        });
      }

      // Check for trailing whitespace
      if (line.endsWith(' ') || line.endsWith('\t')) {
        result.warnings.push({
          line: lineNumber,
          column: line.length,
          message: 'Trailing whitespace detected',
          rule: 'trailing-whitespace'
        });
      }

      // Check for mixed tabs and spaces
      if (line.includes(' ') && line.includes('\t')) {
        result.warnings.push({
          line: lineNumber,
          column: 1,
          message: 'Mixed tabs and spaces detected. Use consistent indentation.',
          rule: 'mixed-indentation'
        });
      }
    }

    // Check for empty code
    if (code.trim().length === 0) {
      result.warnings.push({
        line: 1,
        column: 1,
        message: 'Code block is empty',
        rule: 'empty-code'
      });
    }
  }

  /**
   * Formats validation results into a user-friendly message
   */
  public formatValidationResults(results: CodeValidationResult[]): string {
    if (results.length === 0) {
      return '';
    }

    let message = '## Code Validation Results\n\n';
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const blockNumber = i + 1;
      
      message += `### Code Block ${blockNumber} (${result.language})\n`;
      
      if (result.isValid && result.errors.length === 0 && result.warnings.length === 0) {
        message += '✅ **Code looks good!**\n\n';
        continue;
      }

      if (result.errors.length > 0) {
        message += '❌ **Errors found:**\n';
        for (const error of result.errors) {
          message += `- **Line ${error.line}:** ${error.message}\n`;
        }
        message += '\n';
      }

      if (result.warnings.length > 0) {
        message += '⚠️ **Warnings:**\n';
        for (const warning of result.warnings) {
          message += `- **Line ${warning.line}:** ${warning.message}\n`;
        }
        message += '\n';
      }
    }

    return message;
  }
}

// Export singleton instance
export const codeValidator = CodeValidator.getInstance();
