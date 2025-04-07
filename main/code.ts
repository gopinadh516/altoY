import { FigmaNodeData } from '../src/types/figma-types';

// Plugin state & helpers
interface PluginState {
  commandId: string;
}

const state: PluginState = {
  commandId: generateCommandId(),
};

function generateCommandId(): string {
  return 'cmd_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Show UI with increased size for better JSON editing
figma.showUI(__html__, { width: 450, height: 600 });

// Message handler
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'create-design':
      if (msg.data && msg.data.document) {
        const convertedData = convertFigmaExportToNodeData(msg.data);
        await handleCreateDesign(convertedData);
      } else {
        await handleCreateDesign(msg.data);
      }
      break;

    case 'notify':
      figma.notify(msg.message);
      break;

    case 'close-plugin':
      figma.closePlugin();
      break;
  }
};

// Convert Figma export JSON to our FigmaNodeData format
function convertFigmaExportToNodeData(figmaExport: any): FigmaNodeData {
  if (
    figmaExport.document &&
    figmaExport.document.children &&
    figmaExport.document.children.length > 0
  ) {
    const canvas = figmaExport.document.children[0];
    if (canvas && canvas.children && canvas.children.length > 0) {
      const mainNode = canvas.children[0];
      if (mainNode) {
        return convertNodeFormat(mainNode);
      }
    }
  }
  return {
    type: 'FRAME',
    name: 'Converted Frame',
    width: 400,
    height: 400,
    fills: [
      {
        type: 'SOLID',
        color: { r: 1, g: 1, b: 1 },
        opacity: 1,
      },
    ],
  };
}

// Convert each node recursively
function convertNodeFormat(node: any): FigmaNodeData {
  const result: FigmaNodeData = {
    type: node.type,
    name: node.name,
  };

  // Copy bounding box
  if (node.absoluteBoundingBox) {
    result.x = node.absoluteBoundingBox.x;
    result.y = node.absoluteBoundingBox.y;
    result.width = node.absoluteBoundingBox.width;
    result.height = node.absoluteBoundingBox.height;
  }

  // Handle background color
  if (node.backgroundColor) {
    result.fills = [
      {
        type: 'SOLID',
        color: {
          r: node.backgroundColor.r,
          g: node.backgroundColor.g,
          b: node.backgroundColor.b,
        },
        opacity: node.backgroundColor.a,
      },
    ];
  }

  // Handle fills from style
  if (node.style && node.style.fill) {
    result.fills = [
      {
        type: 'SOLID',
        color: {
          r: node.style.fill.r,
          g: node.style.fill.g,
          b: node.style.fill.b,
        },
        opacity: node.style.fill.a || 1,
      },
    ];
  }

  // Handle text properties
  if (node.type === 'TEXT') {
    result.characters = node.characters;
    if (node.style) {
      result.fontSize = node.style.fontSize;
      result.fontName = {
        family: node.style.fontFamily || 'Inter',
        style: node.style.fontWeight >= 700 ? 'Bold' : 'Regular',
      };
    }
  }

  // Recursively convert child nodes
  if (node.children && Array.isArray(node.children)) {
    result.children = node.children.map((child: any) => convertNodeFormat(child));
  }

  return result;
}

// Track if we're generating a design
let isDesignGenerating = false;

async function handleCreateDesign(data: FigmaNodeData) {
  if (isDesignGenerating) {
    console.warn('Design generation is in progress. Skipping duplicate request.');
    return;
  }

  isDesignGenerating = true;

  try {
    if (!isValidFigmaNodeData(data)) {
      throw new Error('Invalid JSON structure for FigmaNodeData');
    }

    // Create fresh page
    const newPage = figma.createPage();
    newPage.name = 'Generated Design';
    figma.currentPage = newPage;

    // Create root node(s)
    const node = await createNodesFromJson(data);

    // Append node(s) directly to the page (no extra container)
    if (node) {
      newPage.appendChild(node);
      figma.viewport.scrollAndZoomIntoView([node]);
    }

    figma.notify('Design generated successfully!');
  } catch (error) {
    console.error('Error processing message:', error);
    figma.notify(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, {
      error: true,
    });
  } finally {
    isDesignGenerating = false;
  }
}

// Recursively create nodes
async function createNodesFromJson(data: FigmaNodeData): Promise<SceneNode | null> {
  try {
    const node = await createNode(data);
    if (!node) return null;

    await applyCommonProperties(node, data);

    // Recursively append children
    if (data.children && Array.isArray(data.children) && 'appendChild' in node) {
      for (const childData of data.children) {
        const childNode = await createNodesFromJson(childData);
        if (childNode) {
          (node as BaseNode & ChildrenMixin).appendChild(childNode);
        }
      }
    }

    return node;
  } catch (error) {
    console.error('Error creating node:', error);
    throw error;
  }
}

// Updated createNode function
async function createNode(data: FigmaNodeData): Promise<SceneNode | null> {
  let node: SceneNode | null = null;

  // Optional logic for specialized semantic types
  if (data.semanticType === 'input') {
    return await createInputField(data);
  }

  switch (data.type) {
    case 'FRAME':
    case 'CANVAS':
      node = figma.createFrame();
      break;

    case 'TEXT': {
      const textNode = figma.createText();
      const fontName = data.fontName || { family: 'Inter', style: 'Regular' };

      try {
        await figma.loadFontAsync(fontName);
        textNode.fontName = fontName;
        if (data.characters) {
          textNode.characters = data.characters;
        }
      } catch (error) {
        console.error('Error loading font:', error);
        return null;
      }

      if (data.fontSize !== undefined) textNode.fontSize = data.fontSize;
      if (data.fills) textNode.fills = data.fills;
      if (data.textAlignHorizontal) textNode.textAlignHorizontal = data.textAlignHorizontal;
      if (data.textAlignVertical) textNode.textAlignVertical = data.textAlignVertical;

      node = textNode;
      break;
    }

    case 'RECTANGLE':
      node = figma.createRectangle();
      break;

    case 'ELLIPSE':
      node = figma.createEllipse();
      break;

    case 'GROUP':
      // First gather the child nodes
      if (data.children && data.children.length > 0) {
        const childNodes: SceneNode[] = [];
        for (const childData of data.children) {
          const childNode = await createNode(childData);
          if (childNode) {
            childNodes.push(childNode);
          }
        }
        // Only create a group if we have at least one child node
        if (childNodes.length > 0) {
          node = figma.group(childNodes, figma.currentPage);
        } else {
          console.warn('Skipping creation of empty group');
          return null;
        }
      } else {
        console.warn('Skipping creation of empty group');
        return null;
      }
      break;

    case 'INSTANCE':
      if (!data.componentId) {
        console.warn(`Missing componentId for INSTANCE node: ${data.name || 'Unnamed INSTANCE'}`);
        return null;
      }
      const component = figma.getNodeById(data.componentId);
      if (component && component.type === 'COMPONENT') {
        node = (component as ComponentNode).createInstance();
      } else {
        console.warn(`Component with ID ${data.componentId} not found for INSTANCE node: ${data.name || 'Unnamed INSTANCE'}`);
      }
      break;

    default:
      figma.notify(`Unsupported node type: ${data.type}`);
      break;
  }

  if (!node) return null;
  await applyCommonProperties(node, data);
  return node;
}

// Apply shared properties to a node
async function applyCommonProperties(node: SceneNode, data: FigmaNodeData) {
  if (data.name) node.name = data.name;
  if (typeof data.visible === 'boolean') node.visible = data.visible;
  if (typeof data.locked === 'boolean') node.locked = data.locked;

  if (typeof data.x === 'number') node.x = data.x;
  if (typeof data.y === 'number') node.y = data.y;

  if ('resize' in node) {
    const width = typeof data.width === 'number' ? data.width : node.width;
    const height = typeof data.height === 'number' ? data.height : node.height;
    node.resize(width, height);
  }

  if (typeof data.rotation === 'number' && 'rotation' in node) {
    node.rotation = data.rotation;
  }

  if (typeof data.opacity === 'number' && 'opacity' in node) {
    node.opacity = data.opacity;
  }

  if ('fills' in node && data.fills) {
    (node as GeometryMixin).fills = data.fills as Paint[];
  }

  if ('strokes' in node && data.strokes) {
    (node as GeometryMixin).strokes = data.strokes as Paint[];
    if (typeof data.strokeWeight === 'number') {
      (node as GeometryMixin).strokeWeight = data.strokeWeight;
    }
  }
}

// Example: A specialized function for creating an "input" field
async function createInputField(data: any): Promise<FrameNode> {
  const inputFrame = figma.createFrame();
  inputFrame.layoutMode = 'VERTICAL';
  inputFrame.itemSpacing = 8;
  inputFrame.counterAxisSizingMode = 'AUTO';
  inputFrame.primaryAxisSizingMode = 'AUTO';
  inputFrame.paddingLeft = 4;
  inputFrame.paddingRight = 4;
  inputFrame.paddingTop = 4;
  inputFrame.paddingBottom = 4;

  // Label
  const label = figma.createText();
  await figma.loadFontAsync({ family: 'Roboto', style: 'Regular' });
  label.characters = data.label || 'Label';
  label.fontSize = 12;
  inputFrame.appendChild(label);

  // Input box
  const inputBox = figma.createRectangle();
  inputBox.resize(280, 36);
  inputBox.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  inputBox.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
  inputBox.strokeWeight = 1;
  inputBox.cornerRadius = 4;

  // Placeholder text
  const placeholder = figma.createText();
  await figma.loadFontAsync({ family: 'Roboto', style: 'Regular' });
  placeholder.characters = data.placeholder || 'Enter value';
  placeholder.fontSize = 12;
  placeholder.opacity = 0.5;

  // Group input box + placeholder
  const inputGroup = figma.createFrame();
  inputGroup.layoutMode = 'NONE';
  inputGroup.resize(280, 36);
  inputGroup.appendChild(inputBox);
  inputGroup.appendChild(placeholder);

  placeholder.x = 12;
  placeholder.y = 10;

  inputFrame.appendChild(inputGroup);
  return inputFrame;
}

// Validate FigmaNodeData
function isValidFigmaNodeData(data: any): data is FigmaNodeData {
  const validTypes = [
    'FRAME', 'TEXT', 'RECTANGLE', 'GROUP', 'ELLIPSE',
    'POLYGON', 'STAR', 'LINE', 'VECTOR', 'COMPONENT',
    'INSTANCE', 'DOCUMENT', 'CANVAS'
  ];

  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.type === 'string' &&
    validTypes.includes(data.type)
  );
}