import { Project } from '../models/Project.model.js';
import { logger } from '../utils/logger.js';

export interface ProjectReportData {
  project: any;
  includeTasks?: boolean;
  includeArtifacts?: boolean;
  includeLogs?: boolean;
  includeAgents?: boolean;
}

export interface ReportOptions {
  format: 'pdf' | 'docx';
  includeTasks?: boolean;
  includeArtifacts?: boolean;
  includeLogs?: boolean;
  includeAgents?: boolean;
  title?: string;
}

/**
 * Generate PDF report for a project
 */
export async function generatePDFReport(data: ProjectReportData, options: ReportOptions): Promise<Buffer> {
  // Dynamic import for pdfkit
  let PDFDocument: any;
  try {
    PDFDocument = (await import('pdfkit')).default;
  } catch (error) {
    throw new Error('PDFKit is not installed. Please install it: npm install pdfkit @types/pdfkit');
  }
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      const { project } = data;
      const title = options.title || `Project Report: ${project.name}`;

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);

      // Project Overview
      doc.fontSize(16).font('Helvetica-Bold').text('Project Overview');
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Name: ${project.name || 'N/A'}`);
      doc.text(`Description: ${project.description || 'N/A'}`);
      doc.text(`Phase: ${project.currentPhase || project.phase || 'N/A'}`);
      doc.text(`Methodology: ${project.methodology || 'N/A'}`);
      doc.text(`Sprint: ${project.currentSprint || 1}`);
      doc.text(`Created: ${project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}`);
      doc.text(`Last Modified: ${project.lastModified ? new Date(project.lastModified).toLocaleDateString() : 'N/A'}`);
      doc.moveDown();

      // Budget Information
      if (project.budget) {
        doc.fontSize(14).font('Helvetica-Bold').text('Budget');
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica');
        doc.text(`Total Budget: $${project.budget.cap || project.budget.total || 0}`);
        doc.text(`Spent: $${project.budget.spent || project.budget.used || 0}`);
        doc.text(`Remaining: $${(project.budget.cap || project.budget.total || 0) - (project.budget.spent || project.budget.used || 0)}`);
        doc.moveDown();
      }

      // Tasks Section
      if (options.includeTasks !== false && project.tasks && Array.isArray(project.tasks) && project.tasks.length > 0) {
        doc.addPage();
        doc.fontSize(16).font('Helvetica-Bold').text('Tasks');
        doc.moveDown(0.5);
        
        project.tasks.forEach((task: any, index: number) => {
          doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${task.title || 'Untitled Task'}`);
          doc.fontSize(10).font('Helvetica');
          if (task.description) doc.text(`   Description: ${task.description}`);
          doc.text(`   Status: ${task.status || 'Pending'}`);
          doc.text(`   Phase: ${task.phase || 'N/A'}`);
          doc.text(`   Assigned To: ${task.assignedTo || 'Unassigned'}`);
          if (task.progress !== undefined) doc.text(`   Progress: ${task.progress}%`);
          doc.moveDown(0.5);
        });
        doc.moveDown();
      }

      // Artifacts Section
      if (options.includeArtifacts !== false && project.artifacts && Array.isArray(project.artifacts) && project.artifacts.length > 0) {
        doc.addPage();
        doc.fontSize(16).font('Helvetica-Bold').text('Artifacts');
        doc.moveDown(0.5);
        
        project.artifacts.forEach((artifact: any, index: number) => {
          doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${artifact.title || 'Untitled Artifact'}`);
          doc.fontSize(10).font('Helvetica');
          doc.text(`   Type: ${artifact.type || 'N/A'}`);
          doc.text(`   Phase: ${artifact.phase || 'N/A'}`);
          if (artifact.content && typeof artifact.content === 'string') {
            const preview = artifact.content.substring(0, 200);
            doc.text(`   Preview: ${preview}${artifact.content.length > 200 ? '...' : ''}`);
          }
          doc.moveDown(0.5);
        });
        doc.moveDown();
      }

      // Agents Section
      if (options.includeAgents !== false && project.agents && Array.isArray(project.agents) && project.agents.length > 0) {
        doc.addPage();
        doc.fontSize(16).font('Helvetica-Bold').text('Agents');
        doc.moveDown(0.5);
        
        project.agents.forEach((agent: any, index: number) => {
          doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${agent.name || agent.role || 'Unnamed Agent'}`);
          doc.fontSize(10).font('Helvetica');
          doc.text(`   Role: ${agent.role || 'N/A'}`);
          if (agent.expertise) doc.text(`   Expertise: ${agent.expertise}`);
          if (agent.description) doc.text(`   Description: ${agent.description}`);
          doc.moveDown(0.5);
        });
        doc.moveDown();
      }

      // Logs Section
      if (options.includeLogs !== false && project.logs && Array.isArray(project.logs) && project.logs.length > 0) {
        doc.addPage();
        doc.fontSize(16).font('Helvetica-Bold').text('Activity Logs');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        
        project.logs.slice(-50).forEach((log: any) => {
          const timestamp = log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A';
          doc.text(`[${timestamp}] ${log.message || log.text || 'N/A'}`);
        });
        doc.moveDown();
      }

      // Footer
      doc.fontSize(8).font('Helvetica').text(
        `Generated by OrbitAI - Page ${doc.pageNumber}`,
        { align: 'center' }
      );

      doc.end();
    } catch (error: any) {
      logger.error('Error generating PDF report:', error);
      reject(error);
    }
  });
}

/**
 * Generate Word (DOCX) report for a project
 */
export async function generateWordReport(data: ProjectReportData, options: ReportOptions): Promise<Buffer> {
  // Dynamic import for docx
  let docxLib: any;
  try {
    docxLib = await import('docx');
  } catch (error) {
    throw new Error('docx is not installed. Please install it: npm install docx');
  }
  
  try {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } = docxLib;
    const { project } = data;
    const title = options.title || `Project Report: ${project.name}`;

    const children: any[] = [
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        text: `Generated: ${new Date().toLocaleString()}`,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: '' }), // Spacing
    ];

    // Project Overview
    children.push(
      new Paragraph({
        text: 'Project Overview',
        heading: HeadingLevel.HEADING_1,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Name: ', bold: true }),
          new TextRun({ text: project.name || 'N/A' }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Description: ', bold: true }),
          new TextRun({ text: project.description || 'N/A' }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Phase: ', bold: true }),
          new TextRun({ text: project.currentPhase || project.phase || 'N/A' }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Methodology: ', bold: true }),
          new TextRun({ text: project.methodology || 'N/A' }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Sprint: ', bold: true }),
          new TextRun({ text: String(project.currentSprint || 1) }),
        ],
      }),
      new Paragraph({ text: '' }),
    );

    // Budget Information
    if (project.budget) {
      children.push(
        new Paragraph({
          text: 'Budget',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Total Budget: ', bold: true }),
            new TextRun({ text: `$${project.budget.cap || project.budget.total || 0}` }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Spent: ', bold: true }),
            new TextRun({ text: `$${project.budget.spent || project.budget.used || 0}` }),
          ],
        }),
        new Paragraph({ text: '' }),
      );
    }

    // Tasks Section
    if (options.includeTasks !== false && project.tasks && Array.isArray(project.tasks) && project.tasks.length > 0) {
      children.push(
        new Paragraph({
          text: 'Tasks',
          heading: HeadingLevel.HEADING_1,
        })
      );

      const taskRows = project.tasks.map((task: any, index: number) => {
        return new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph(String(index + 1))],
              width: { size: 5, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph(task.title || 'Untitled Task')],
              width: { size: 30, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph(task.status || 'Pending')],
              width: { size: 15, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph(task.phase || 'N/A')],
              width: { size: 15, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph(task.assignedTo || 'Unassigned')],
              width: { size: 20, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph(task.progress !== undefined ? `${task.progress}%` : 'N/A')],
              width: { size: 15, type: WidthType.PERCENTAGE },
            }),
          ],
        });
      });

      children.push(
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('No.')] }),
                new TableCell({ children: [new Paragraph('Title')] }),
                new TableCell({ children: [new Paragraph('Status')] }),
                new TableCell({ children: [new Paragraph('Phase')] }),
                new TableCell({ children: [new Paragraph('Assigned To')] }),
                new TableCell({ children: [new Paragraph('Progress')] }),
              ],
            }),
            ...taskRows,
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
        new Paragraph({ text: '' })
      );
    }

    // Artifacts Section
    if (options.includeArtifacts !== false && project.artifacts && Array.isArray(project.artifacts) && project.artifacts.length > 0) {
      children.push(
        new Paragraph({
          text: 'Artifacts',
          heading: HeadingLevel.HEADING_1,
        })
      );

      project.artifacts.forEach((artifact: any, index: number) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${index + 1}. ${artifact.title || 'Untitled Artifact'}`, bold: true }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '   Type: ', bold: true }),
              new TextRun({ text: artifact.type || 'N/A' }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '   Phase: ', bold: true }),
              new TextRun({ text: artifact.phase || 'N/A' }),
            ],
          }),
        );
      });
      children.push(new Paragraph({ text: '' }));
    }

    // Agents Section
    if (options.includeAgents !== false && project.agents && Array.isArray(project.agents) && project.agents.length > 0) {
      children.push(
        new Paragraph({
          text: 'Agents',
          heading: HeadingLevel.HEADING_1,
        })
      );

      project.agents.forEach((agent: any, index: number) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${index + 1}. ${agent.name || agent.role || 'Unnamed Agent'}`, bold: true }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '   Role: ', bold: true }),
              new TextRun({ text: agent.role || 'N/A' }),
            ],
          }),
        );
      });
      children.push(new Paragraph({ text: '' }));
    }

    const doc = new Document({
      sections: [
        {
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return buffer;
  } catch (error: any) {
    logger.error('Error generating Word report:', error);
    throw error;
  }
}

/**
 * Generate report in specified format
 */
export async function generateProjectReport(
  projectId: string,
  userId: string,
  options: ReportOptions
): Promise<Buffer> {
  const project = await Project.findOne({
    _id: projectId,
    userId: userId,
  }).lean();

  if (!project) {
    throw new Error('Project not found');
  }

  const reportData: ProjectReportData = {
    project: {
      ...project,
      _id: project._id.toString(),
    },
    includeTasks: options.includeTasks,
    includeArtifacts: options.includeArtifacts,
    includeLogs: options.includeLogs,
    includeAgents: options.includeAgents,
  };

  if (options.format === 'pdf') {
    return await generatePDFReport(reportData, options);
  } else if (options.format === 'docx') {
    return await generateWordReport(reportData, options);
  } else {
    throw new Error(`Unsupported format: ${options.format}`);
  }
}
