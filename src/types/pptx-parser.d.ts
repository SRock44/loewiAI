declare module 'pptx-parser' {
  export class PPTXParser {
    slides: Array<{
      content: Array<{
        type?: string;
        text?: string;
        [key: string]: any;
      }>;
      [key: string]: any;
    }>;
    
    parse(arrayBuffer: ArrayBuffer): Promise<void>;
  }
}
