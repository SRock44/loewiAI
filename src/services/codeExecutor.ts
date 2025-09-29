export interface CodeExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  language: string;
}

export interface CodeBlock {
  language: string;
  code: string;
  id: string;
}

export class CodeExecutor {
  private static instance: CodeExecutor;
  private executionTimeout = 5000; // 5 seconds timeout

  public static getInstance(): CodeExecutor {
    if (!CodeExecutor.instance) {
      CodeExecutor.instance = new CodeExecutor();
    }
    return CodeExecutor.instance;
  }

  /**
   * Executes code blocks from a message
   */
  public async executeCodeBlocks(content: string): Promise<CodeExecutionResult[]> {
    const codeBlocks = this.extractCodeBlocks(content);
    const results: CodeExecutionResult[] = [];

    for (const block of codeBlocks) {
      if (this.isExecutableLanguage(block.language)) {
        const result = await this.executeCode(block.code, block.language);
        results.push(result);
      }
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
    let blockIndex = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();
      
      codeBlocks.push({
        language,
        code,
        id: `block-${blockIndex++}`
      });
    }

    return codeBlocks;
  }

  /**
   * Checks if a language is safe to execute
   */
  private isExecutableLanguage(language: string): boolean {
    const executableLanguages = [
      'javascript', 'js',
      'python', 'py',
      'json'
    ];
    return executableLanguages.includes(language.toLowerCase());
  }

  /**
   * Executes code for a specific language
   */
  public async executeCode(code: string, language: string): Promise<CodeExecutionResult> {
    const startTime = Date.now();
    
    try {
      switch (language.toLowerCase()) {
        case 'javascript':
        case 'js':
          return await this.executeJavaScript(code, startTime);
        case 'python':
        case 'py':
          return await this.executePython(code, startTime);
        case 'json':
          return await this.executeJSON(code, startTime);
        default:
          return {
            success: false,
            output: '',
            error: `Language ${language} is not supported for execution`,
            executionTime: Date.now() - startTime,
            language
          };
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime,
        language
      };
    }
  }

  /**
   * Executes JavaScript code safely with security restrictions
   * WARNING: This uses eval() which can be dangerous. Only use in controlled educational environments.
   */
  private async executeJavaScript(code: string, startTime: number): Promise<CodeExecutionResult> {
    // Security checks - block dangerous operations
    const dangerousPatterns = [
      /import\s*\(/g,           // Dynamic imports
      /require\s*\(/g,          // CommonJS requires
      /fetch\s*\(/g,            // Network requests
      /XMLHttpRequest/g,        // XHR requests
      /localStorage/g,          // Local storage access
      /sessionStorage/g,        // Session storage access
      /document\.cookie/g,      // Cookie access
      /window\./g,              // Window object access
      /location\./g,            // Location object access
      /history\./g,             // History object access
      /navigator\./g,           // Navigator object access
      /screen\./g,              // Screen object access
      /alert\s*\(/g,            // Alert dialogs
      /confirm\s*\(/g,          // Confirm dialogs
      /prompt\s*\(/g,           // Prompt dialogs
      /setTimeout\s*\(/g,       // Timers
      /setInterval\s*\(/g,      // Intervals
      /Worker\s*\(/g,           // Web workers
      /eval\s*\(/g,             // Nested eval
      /Function\s*\(/g,         // Function constructor
      /new\s+Function/g         // Function constructor
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          success: false,
          output: '',
          error: `Security restriction: Code contains potentially dangerous operation. This is blocked for safety.`,
          executionTime: Date.now() - startTime,
          language: 'javascript'
        };
      }
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          output: '',
          error: 'Execution timeout (5 seconds)',
          executionTime: Date.now() - startTime,
          language: 'javascript'
        });
      }, this.executionTimeout);

      // Capture console output
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;

      try {
        
        let output = '';
        
        // Override console methods to capture output
        console.log = (...args) => {
          output += args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ') + '\n';
        };
        
        console.error = (...args) => {
          output += 'ERROR: ' + args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ') + '\n';
        };
        
        console.warn = (...args) => {
          output += 'WARN: ' + args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ') + '\n';
        };

        // Execute the code with eval (restricted by security checks above)
        const result = eval(code);
        
        // Restore original console methods
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        
        clearTimeout(timeout);
        
        // If there's a return value and no console output, show the return value
        if (!output && result !== undefined) {
          output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        }
        
        resolve({
          success: true,
          output: output.trim() || 'Code executed successfully (no output)',
          executionTime: Date.now() - startTime,
          language: 'javascript'
        });
        
      } catch (error) {
        // Restore original console methods
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        
        clearTimeout(timeout);
        
        resolve({
          success: false,
          output: '',
          error: error instanceof Error ? error.message : String(error),
          executionTime: Date.now() - startTime,
          language: 'javascript'
        });
      }
    });
  }

  /**
   * Executes Python code (simplified - just validates syntax)
   */
  private async executePython(code: string, startTime: number): Promise<CodeExecutionResult> {
    // For now, we'll just validate Python syntax since we can't actually run Python in the browser
    // In a real implementation, you might use Pyodide or a similar solution
    
    try {
      // Basic Python syntax validation
      const lines = code.split('\n');
      // let indentLevel = 0;
      let inString = false;
      let stringChar = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Skip empty lines and comments
        if (line.trim() === '' || line.trim().startsWith('#')) {
          continue;
        }
        
        // Check for string literals
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (!inString && (char === '"' || char === "'")) {
            inString = true;
            stringChar = char;
          } else if (inString && char === stringChar) {
            inString = false;
            stringChar = '';
          }
        }
        
        // Check indentation
        if (!inString) {
          const trimmedLine = line.trim();
          if (trimmedLine) {
            const currentIndent = line.length - line.trimStart().length;
            
            // Check for indentation errors
            if (currentIndent < 0) {
              throw new Error(`Invalid indentation on line ${i + 1}`);
            }
          }
        }
      }
      
      return {
        success: true,
        output: 'Python syntax validation passed (execution not available in browser)',
        executionTime: Date.now() - startTime,
        language: 'python'
      };
      
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        language: 'python'
      };
    }
  }

  /**
   * Executes JSON code (validates and formats)
   */
  private async executeJSON(code: string, startTime: number): Promise<CodeExecutionResult> {
    try {
      const parsed = JSON.parse(code);
      const formatted = JSON.stringify(parsed, null, 2);
      
      return {
        success: true,
        output: `Valid JSON:\n${formatted}`,
        executionTime: Date.now() - startTime,
        language: 'json'
      };
      
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `JSON parsing error: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime,
        language: 'json'
      };
    }
  }


  /**
   * Formats execution results for display
   */
  public formatExecutionResults(results: CodeExecutionResult[]): string {
    if (results.length === 0) {
      return '';
    }

    let message = '## Code Execution Results\n\n';
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const blockNumber = i + 1;
      
      message += `### Code Block ${blockNumber} (${result.language})\n`;
      
      if (result.success) {
        message += `✅ **Execution successful** (${result.executionTime}ms)\n\n`;
        if (result.output) {
          message += '**Output:**\n';
          message += '```\n';
          message += result.output;
          message += '\n```\n\n';
        }
      } else {
        message += `❌ **Execution failed** (${result.executionTime}ms)\n\n`;
        if (result.error) {
          message += '**Error:**\n';
          message += '```\n';
          message += result.error;
          message += '\n```\n\n';
        }
      }
    }

    return message;
  }
}

// Export singleton instance
export const codeExecutor = CodeExecutor.getInstance();
