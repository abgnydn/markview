/**
 * MarkView Context Bridge — Shared Types
 */

// Chrome extension message types
export type MessageType =
  | 'CONNECT'
  | 'DISCONNECT'
  | 'GET_STATE'
  | 'CALL_TOOL'
  | 'LIST_TOOLS'
  | 'CONNECTION_STATE'
  | 'TOOLS_DISCOVERED'
  | 'RENDER_AI_UI'
  | 'LOG';

export interface ConnectMessage {
  type: 'CONNECT';
  roomId: string;
  signalingUrl: string;
  target?: string;
}

export interface DisconnectMessage {
  type: 'DISCONNECT';
  target?: string;
}

export interface GetStateMessage {
  type: 'GET_STATE';
  target?: string;
}

export interface CallToolMessage {
  type: 'CALL_TOOL';
  toolName: string;
  args: Record<string, unknown>;
  target?: string;
}

export interface ListToolsMessage {
  type: 'LIST_TOOLS';
  target?: string;
}

export interface ConnectionStateMessage {
  type: 'CONNECTION_STATE';
  state: 'connected' | 'disconnected' | 'failed';
}

export interface ToolsDiscoveredMessage {
  type: 'TOOLS_DISCOVERED';
  tools: ToolInfo[];
}

export interface RenderAIUIMessage {
  type: 'RENDER_AI_UI';
  payload: string;
}

export interface LogMessage {
  type: 'LOG';
  message: string;
  logType?: 'error' | '';
}

export type ExtensionMessage =
  | ConnectMessage
  | DisconnectMessage
  | GetStateMessage
  | CallToolMessage
  | ListToolsMessage
  | ConnectionStateMessage
  | ToolsDiscoveredMessage
  | RenderAIUIMessage
  | LogMessage;

// Tool metadata
export interface ToolInfo {
  name: string;
  description: string;
}

// Chat
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// MCP JSON-RPC
export interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: Record<string, unknown>;
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

// Signaling server messages
export interface SignalingJoin {
  type: 'join';
  room: string;
}

export interface SignalingPeerJoined {
  type: 'peer_joined';
  room: string;
}

export interface SignalingOffer {
  type: 'offer';
  room: string;
  offer: RTCSessionDescriptionInit;
}

export interface SignalingAnswer {
  type: 'answer';
  room: string;
  answer: RTCSessionDescriptionInit;
}

export interface SignalingCandidate {
  type: 'candidate';
  room: string;
  candidate: RTCIceCandidateInit;
}

export type SignalingMessage =
  | SignalingJoin
  | SignalingPeerJoined
  | SignalingOffer
  | SignalingAnswer
  | SignalingCandidate;
