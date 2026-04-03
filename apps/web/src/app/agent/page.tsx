import { AgentDemo } from '@/components/agent/agent-demo';

export default function AgentDemoPage() {
  return (
    <main className="min-h-screen bg-black flex flex-col p-8 pt-24">
      <div className="max-w-[1200px] w-full mx-auto flex-1 flex flex-col">
        <div className="mb-8">
          <h1 className="text-4xl font-semibold text-white tracking-tight mb-2">Universal Context Bridge</h1>
          <p className="text-zinc-400 max-w-2xl text-lg">
            This demo demonstrates the "Plaid for AI" layer. Run the MarkView CLI locally via <code className="bg-white/10 px-2 py-1 rounded text-sm mx-1">npm run start -- --webrtc --room demo-room</code>, then connect below to stream your local context securely into the browser without any central databases.
          </p>
        </div>
        
        <div className="flex-1 min-h-[600px]">
          <AgentDemo />
        </div>
      </div>
    </main>
  );
}
