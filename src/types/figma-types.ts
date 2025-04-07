export interface Paint {
    type: string;
    color?: {
      r: number;
      g: number;
      b: number;
      a?: number;
    };
    opacity?: number;
  }
  
  export interface FontName {
    family: string;
    style: string;
  }
  export interface FigmaNodeData {
    type: string; // Node type (e.g., FRAME, TEXT, RECTANGLE, etc.)
    name?: string; // Node name
    visible?: boolean; // Visibility of the node
    locked?: boolean; // Whether the node is locked
    x?: number; // X position
    y?: number; // Y position
    width?: number; // Width of the node
    height?: number; // Height of the node
    rotation?: number; // Rotation angle
    opacity?: number; // Opacity of the node
    fills?: Paint[]; // Fill styles
    strokes?: Paint[]; // Stroke styles
    strokeWeight?: number; // Stroke weight
    layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL'; // Layout mode
    primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'; // Primary axis alignment
    counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'; // Counter axis alignment
    itemSpacing?: number; // Spacing between items
    paddingLeft?: number; // Padding on the left
    paddingRight?: number; // Padding on the right
    paddingTop?: number; // Padding on the top
    paddingBottom?: number; // Padding on the bottom
    fontSize?: number; // Font size (for text nodes)
    fontName?: FontName; // Font name (for text nodes)
    characters?: string; // Text content (for text nodes)
    textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'; // Horizontal text alignment
    textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM'; // Vertical text alignment
    children?: FigmaNodeData[]; // Child nodes (for groups, frames, etc.)
    componentId?: string; // Component ID (for instances)
  }