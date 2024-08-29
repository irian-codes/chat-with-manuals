export type SectionNode = {
  type: 'section';
  title: string;
  level: number;
  headerRouteLevels: string;
  content: string;
  tables: Map<number, string>;
  subsections: SectionNode[];
};
