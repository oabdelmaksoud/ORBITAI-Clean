/**
 * Type declarations for modules without type definitions
 */

declare module '@prisma/client' {
  export const PrismaClient: any;
  export type PrismaClient = any;
}

declare module '@trycua/agent' {
  export const Agent: any;
  export type Agent = any;
  export const AgentConfig: any;
  export type AgentConfig = any;
}

declare module '@sentry/node' {
  const Sentry: any;
  export = Sentry;
}

declare module 'pdfkit' {
  const PDFDocument: any;
  export = PDFDocument;
}

declare module 'docx' {
  export const Document: any;
  export const Packer: any;
  export const Paragraph: any;
  export const TextRun: any;
  export const HeadingLevel: any;
  export const AlignmentType: any;
  export const Table: any;
  export const TableRow: any;
  export const TableCell: any;
  export const WidthType: any;
  export const BorderStyle: any;
}

declare module 'swagger-jsdoc' {
  const swaggerJsdoc: any;
  export = swaggerJsdoc;
}

declare module 'swagger-ui-express' {
  const swaggerUi: any;
  export = swaggerUi;
}
