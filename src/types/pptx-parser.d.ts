declare module 'pptx-parser' {
  export interface SlideContent {
    type?: string;
    text?: string;
    [key: string]: string | boolean | number | null | undefined;
  }

  export interface Slide {
    content: SlideContent[];
    [key: string]: string | boolean | number | SlideContent[] | null | undefined;
  }

  export class PPTXParser {
    slides: Slide[];

    parse(arrayBuffer: ArrayBuffer): Promise<void>;
  }
}
