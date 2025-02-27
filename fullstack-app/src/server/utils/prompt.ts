import {isStringEmpty} from '@/utils/strings';
import {DOCUMENT_TYPE, type Prisma} from '@prisma/client';
import ISO6391 from 'iso-639-1';

export function getConversationLlmSystemPrompt({
  conversation,
}: {
  conversation: Prisma.ConversationGetPayload<{
    include: {
      documents: {
        include: {
          file: true;
        };
      };
    };
  }>;
}) {
  if (isStringEmpty(conversation.llmSystemPrompt)) {
    const documentLocale = conversation.documents[0]!.file.locale;

    return getDefaultLlmSystemPrompt(documentLocale);
  } else {
    return conversation.llmSystemPrompt;
  }
}

function getDefaultLlmSystemPrompt(documentLocale: string) {
  const defaultLlmSystemPrompt = `You are a highly effective AI assistant specialized in explaining documents with precise logical and factual reasoning. Your responses must be based on the provided context, avoiding any unrelated external information. Ensure that your answers are accurate, clear, and cite references from the given context. If the answer is not available within the context, respond in the user's language with 'I couldn't find the answer in the provided document.' (e.g. English: 'I couldn't find the answer in the provided document.', e.g. Spanish: 'No encontré la respuesta en el documento proporcionado.').

All documents are written in ${ISO6391.getName(documentLocale)}. You must **always** communicate in ${ISO6391.getName(documentLocale)}.

**Language Enforcement:**
- **Detection:** Automatically detect the language of the user's input.
- **Compliance:** 
  - If the user communicates in ${ISO6391.getName(documentLocale)}, proceed normally.
  - If the user uses a different language, respond **immediately** in the user's language with a clear and polite instruction to continue the conversation in ${ISO6391.getName(documentLocale)}. For example:
    - "Por favor, continúe nuestra conversación en Español para que pueda asistirle de manera efectiva."
    - "Bitte fahren Sie unser Gespräch auf Spanisch fort, damit ich Ihnen effektiv helfen kann."

**Purpose:**
This strict language requirement ensures that all interactions remain consistent and that the assistance provided is both accurate and meaningful. Adhering to the document's language is crucial for maintaining clarity and effectiveness in communication.`;

  return defaultLlmSystemPrompt;
}

export function getLlamaParseInstructionPrompt(
  docType: DOCUMENT_TYPE
): string | null {
  const boardGameManualPrompt = `The provided document is a board game manual. It features complex layouts that include images, arrows, icons replacing text, nested tables (such as character cards), and dice results, among other elements. Your task is to parse the document and output a coherent, readable, and understandable Markdown document by following these guidelines:

  1. **Text Parsing:**  
    - Parse all text —including decorative text— to ensure no potentially important information is skipped.
    - If extra sections such as REMINDER, FUN FACT, or similar notes appear in between major sections, parse them into their own distinct subsections to prevent mixing with the main rules text.

  2. **Tables and Subsections:**  
    - For nested tables (for example, character cards that may appear as tables within tables), treat them as new subsections and render the tables beneath the subsection header.

  3. **Visual Elements and Iconography:**  
    - **Images:** Do not parse images (e.g., photos of game cards, tokens, boards).  
    - **Icons:** Only parse icons that carry meaningful information.  
      - If an icon (such as a die icon used in place of a text value) conveys important game mechanics, replace it with a concise textual description (e.g., convert “🎲” used to indicate a die result into “1” if that is the intended value).  
      - Ignore icons that are purely decorative (for instance, a sword icon preceding a header should be omitted).

  4. **Game Mechanics:**  
    - Render dice results and other game-specific icons as brief, natural language descriptions that respect the document's flow and maintain clarity.

  5. **Overall Structure:**  
    - Preserve the original structure and ordering of the document, while adjusting the formatting where necessary to ensure the parsed output is clear and easy to follow.

  Apply these guidelines consistently to produce a Markdown document that is both faithful to the source material and optimized for human readability.`;

  const productManualPrompt = `The provided document is a physical product manual intended to guide users in operating, assembling, maintaining, and troubleshooting a machine or device. It features structured sections, step-by-step instructions with accompanying diagrams, technical data, and safety warnings. Your task is to parse the document and output a coherent, readable, and understandable Markdown document by following these guidelines:

1. **Text Parsing:**  
   - Parse all text —including decorative text— to ensure that no potentially important information is missed.
   - Identify and separate distinct sections such as Safety Warnings, Assembly Instructions, Operation Instructions, Maintenance, Troubleshooting, and Technical Specifications.  
   - If notes like REMINDER, WARNING, or similar notes appear within a major section, render them as distinct subsections to keep the instructions clear.

2. **Instructional Diagrams & Step-by-Step Instructions:**  
   - When the document contains numbered steps accompanied by images or diagrams that illustrate the process (e.g., how to change a filter), transcribe those images into concise, clear textual descriptions that capture their intended meaning.
   - Preserve the numbering and ordering of steps to maintain the original flow.

3. **Visual Elements & Iconography:**  
   - **Instructional Images:** Transcribe images that carry meaningful information (such as diagrams of machine parts, control panels, or step illustrations) into clear text.  
   - **Non-Instructional Images:** Do not parse images that are purely decorative.
   - **Icons & Symbols:** Only parse icons or symbols that contribute essential information (e.g., safety symbols, button labels, or control indicators). Convert these into succinct textual descriptions (for example, if a control panel image shows a “Power” button, describe it as “Power Button” with its function). Ignore decorative icons.

4. **Technical Data & Tables:**  
   - Parse tables accurately into Markdown tables, ensuring that all technical specifications (such as dimensions, power requirements, or parts lists) are retained.
   - For sections with exploded diagrams or parts lists, extract the information into structured lists with clear, brief descriptions of each component.

5. **Control Panels & Button Labels:**  
   - If the manual includes images of control panels or interfaces, transcribe the labeled elements (such as “Power,” “Mode,” or “Fan Speed”) into bullet points with corresponding explanations.
   - Ensure that the textual descriptions capture the intended function of each control element.

6. **Overall Structure:**  
   - Preserve the original structure and ordering of the document, adjusting formatting as needed to ensure clarity.
   - The final output should be formatted in Markdown with proper headings, bullet points, and sections to make the manual easy to follow.

Apply these guidelines consistently to produce a Markdown document that is both faithful to the original product manual and optimized for user readability.`;

  const reportPrompt = `The provided document is a report —such as an economic report, or a political institution report— or a research paper that contains structured sections, chapters, titles, and subtitles. It may also include charts, graphs, diagrams, and other imagery that conveys important information. Your task is to parse the document and output a coherent, readable, and well-organized Markdown document by following these guidelines:

1. **Text Parsing:**  
   - Parse all text —including headings, subheadings, body text, summaries, and executive summaries— to ensure no important details are missed.  
   - Preserve the hierarchical structure of the document, including chapters, sections, subsections, and bullet points.  
   - If sidebars, notes or brief summaries appear within major sections, render them as distinct subsections to maintain clarity.

2. **Charts, Graphs, and Diagrams:**  
   - Parse all images, charts, graphs, and diagrams that carry meaningful information.  
   - Transcribe these visual elements into concise textual descriptions that capture the key data, trends, or insights they represent.  
   - For charts and graphs, include important details such as axis labels, data trends, and significant statistical highlights.
   - If convenient, parse these into tables.

3. **Tables and Structured Data:**  
   - Accurately parse any tables or structured data into Markdown tables, ensuring that all numerical data, units, and headers are retained.  
   - Maintain the integrity of any financial or statistical data presented in the report.

4. **Technical and Analytical Content:**  
   - Retain any technical language and analytical commentary present in the document.
   - Output any math equation in proper LaTeX Markdown (between $$).

5. **Overall Structure and Readability:**  
   - Preserve the original structure and logical ordering of the report.  
   - Format the final output in Markdown with proper headings, bullet points, and clear section divisions, ensuring the document is easy to follow.  
   - The parsed document should faithfully represent the content of the original report while being optimized for reader comprehension.

Apply these guidelines consistently to produce a Markdown document that is both faithful to the original report and optimized for readability.`;

  switch (docType) {
    case DOCUMENT_TYPE.BOARD_GAME_MANUAL:
      return boardGameManualPrompt;

    case DOCUMENT_TYPE.PRODUCT_MANUAL:
      return productManualPrompt;

    case DOCUMENT_TYPE.REPORT:
      return reportPrompt;

    case DOCUMENT_TYPE.OTHER:
    default:
      console.warn(
        `No LlamaParse instruction prompt for document type ${docType}. Returning null.`
      );

      return null;
  }
}
