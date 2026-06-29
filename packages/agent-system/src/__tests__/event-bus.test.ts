import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { EventBus } from '../communication/event-bus.js';
import { type AgentMessage, MessageType } from '../types/index.js';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus({ replyTimeout: 1000 });
  });

  afterEach(() => {
    eventBus.dispose();
  });

  function createMessage(overrides?: Partial<AgentMessage>): AgentMessage {
    return {
      id: crypto.randomUUID(),
      from: 'agent-1',
      to: 'agent-2',
      type: MessageType.TASK_ASSIGNMENT,
      payload: { data: 'test' },
      timestamp: new Date(),
      correlationId: crypto.randomUUID(),
      ...overrides,
    };
  }

  describe('subscribe/publish', () => {
    it('should deliver messages to subscribers of matching type', () => {
      const handler = vi.fn();
      eventBus.subscribe(MessageType.TASK_ASSIGNMENT, handler);

      const message = createMessage();
      eventBus.publish(message);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should not deliver messages to subscribers of different type', () => {
      const handler = vi.fn();
      eventBus.subscribe(MessageType.STATUS_UPDATE, handler);

      const message = createMessage({ type: MessageType.TASK_ASSIGNMENT });
      eventBus.publish(message);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should support multiple subscribers for the same type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe(MessageType.TASK_ASSIGNMENT, handler1);
      eventBus.subscribe(MessageType.TASK_ASSIGNMENT, handler2);

      const message = createMessage();
      eventBus.publish(message);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should return an unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe(MessageType.TASK_ASSIGNMENT, handler);

      eventBus.publish(createMessage());
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      eventBus.publish(createMessage());
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribeAgent', () => {
    it('should deliver messages directed at a specific agent', () => {
      const handler = vi.fn();
      eventBus.subscribeAgent('agent-2', handler);

      const message = createMessage({ to: 'agent-2' });
      eventBus.publish(message);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should not deliver messages to other agents', () => {
      const handler = vi.fn();
      eventBus.subscribeAgent('agent-3', handler);

      const message = createMessage({ to: 'agent-2' });
      eventBus.publish(message);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('request/reply', () => {
    it('should resolve when a correlated reply is received', async () => {
      const correlationId = crypto.randomUUID();
      const requestMessage = createMessage({
        type: MessageType.REQUEST,
        correlationId,
      });

      // Set up a subscriber that sends a reply
      eventBus.subscribe(MessageType.REQUEST, (msg) => {
        const reply: AgentMessage = {
          id: crypto.randomUUID(),
          from: msg.to,
          to: msg.from,
          type: MessageType.REPLY,
          payload: { result: 'done' },
          timestamp: new Date(),
          correlationId: msg.correlationId,
        };
        setTimeout(() => eventBus.publish(reply), 10);
      });

      const reply = await eventBus.request(requestMessage, 5000);
      expect(reply.type).toBe(MessageType.REPLY);
      expect(reply.payload).toEqual({ result: 'done' });
      expect(reply.correlationId).toBe(correlationId);
    });

    it('should reject on timeout', async () => {
      const requestMessage = createMessage({
        type: MessageType.REQUEST,
        correlationId: crypto.randomUUID(),
      });

      await expect(eventBus.request(requestMessage, 50)).rejects.toThrow('Request timed out');
    });
  });

  describe('subscriberCount', () => {
    it('should return the correct subscriber count', () => {
      expect(eventBus.subscriberCount(MessageType.TASK_ASSIGNMENT)).toBe(0);

      eventBus.subscribe(MessageType.TASK_ASSIGNMENT, vi.fn());
      expect(eventBus.subscriberCount(MessageType.TASK_ASSIGNMENT)).toBe(1);

      eventBus.subscribe(MessageType.TASK_ASSIGNMENT, vi.fn());
      expect(eventBus.subscriberCount(MessageType.TASK_ASSIGNMENT)).toBe(2);
    });
  });

  describe('dispose', () => {
    it('should remove all listeners and reject pending requests', async () => {
      const handler = vi.fn();
      eventBus.subscribe(MessageType.TASK_ASSIGNMENT, handler);

      const requestPromise = eventBus.request(
        createMessage({ type: MessageType.REQUEST }),
        5000,
      );

      eventBus.dispose();

      eventBus.publish(createMessage());
      expect(handler).not.toHaveBeenCalled();

      await expect(requestPromise).rejects.toThrow('EventBus disposed');
    });
  });
});
