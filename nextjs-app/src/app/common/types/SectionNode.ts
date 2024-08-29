export type SectionNode = {
  type: 'section';
  level: number;
  title: string;
  content: string;
  tables: Map<number, string>;
  subsections: SectionNode[];
};
