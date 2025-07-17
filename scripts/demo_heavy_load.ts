import {
  AckPolicy,
  connect,
  DeliverPolicy,
  ReplayPolicy,
  StorageType,
} from 'nats';

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};

  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value ?? true; // support --flag style too
    }
  }

  return args;
}

const cliArgs = parseArgs(process.argv.slice(2));

const threadOrders = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
};

async function publishMessages(numMessages: number) {
  const nc = await connect({ servers: ['localhost:4222'] });
  const js = nc.jetstream();

  for (let i = 0; i < numMessages; i++) {
    const threadId = Math.floor(Math.random() * 10);
    const message = {
      threadId,
      message: `Message ${i}`,
      timestamp: Date.now(),
      order: threadOrders[threadId]++,
    };
    await js.publish(
      `jarviskit_stream:thread:${threadId}`,
      Buffer.from(JSON.stringify(message)),
    );
    console.log(`Published message ${i} to thread ${threadId}`);
  }

  await nc.drain();
}

async function createConsumer() {
  const nc = await connect({ servers: ['localhost:4222'] });
  const js = nc.jetstream();
  const jsm = await js.jetstreamManager();

  await jsm.consumers.add('jarviskit_stream', {
    filter_subject: 'jarviskit_stream:thread:0',
    deliver_policy: DeliverPolicy.All,
    ack_policy: AckPolicy.Explicit,
    replay_policy: ReplayPolicy.Instant,
    durable_name: 'worker:01',
  });

  const consumer = await js.consumers.get('jarviskit_stream', 'worker:01');

  const messages = await consumer.consume();
  for await (const message of messages) {
    console.log(message.data.toString());
    message.ack();
  }

  await nc.drain();
}

async function serve() {
  const nc = await connect({ servers: ['localhost:4222'] });
  const js = nc.jetstream();
  const jsm = await js.jetstreamManager();

}

async function createStream() {
  const nc = await connect({ servers: ['localhost:4222'] });
  const js = nc.jetstream();
  const jsm = await js.jetstreamManager();

  await jsm.streams.add({
    name: 'jarviskit_stream',
    subjects: ['*'],
    max_age: 1000000000 * 60 * 60, // 1 hour
    storage: StorageType.File,
  });

  await nc.drain();
  console.log('Stream created');
}
(async () => {
  switch (cliArgs.action) {
    case 'create-stream':
      await createStream();
      break;
    case 'publish-messages':
      await publishMessages(10);
      break;
    case 'create-consumer':
      await createConsumer();
      break;
    case 'serve':
      await serve();
      break;
  }
})();
