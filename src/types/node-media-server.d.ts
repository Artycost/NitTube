declare module 'node-media-server' {
	class NodeMediaServer {
		constructor(config: Record<string, unknown>);
		on(event: string, listener: (...args: any[]) => void): void;
		run(): void;
	}
	export default NodeMediaServer;
}
