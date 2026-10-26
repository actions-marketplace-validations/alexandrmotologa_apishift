import { FastifyReply } from 'fastify';

export interface SseClient {
  id: string;
  reply: FastifyReply;
}

export class SseManager {
  private static clients: SseClient[] = [];

  public static addClient(id: string, reply: FastifyReply): void {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders();

    this.clients.push({ id, reply });

    reply.raw.on('close', () => {
      this.removeClient(id);
    });

    // Send initial connected event
    this.sendToClient(reply, 'connected', { status: 'ok', id });
  }

  public static removeClient(id: string): void {
    this.clients = this.clients.filter(c => c.id !== id);
  }

  public static broadcast(eventName: string, data: any): void {
    for (const client of this.clients) {
      this.sendToClient(client.reply, eventName, data);
    }
  }

  private static sendToClient(reply: FastifyReply, eventName: string, data: any): void {
    try {
      const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
      reply.raw.write(payload);
    } catch {
      // client connection might have dropped
    }
  }
}
