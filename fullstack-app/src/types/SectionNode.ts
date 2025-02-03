export type SectionNode = {
  id: string;
  type: 'section';
  title: string;
  level: number;
  headerRoute: string;
  headerRouteLevels: string;
  content: string;
  tables: Map<number, string>;
  subsections: SectionNode[];
};
