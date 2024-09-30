export interface TextSplitter {
  splitText: (text: string) => Promise<string[]>;
}
