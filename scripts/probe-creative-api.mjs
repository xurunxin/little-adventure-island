import {invokeMiniMax} from '../server/minimax.mjs';
import {writeFileSync} from 'node:fs';
const evidence = {};
for (const operation of ['design', 'image']) {
  try {
    const result = await invokeMiniMax({operation, text: operation === 'design' ? '温柔明亮的普通话女性声音，像亲切的幼儿园老师，自然清晰，语速舒缓，有一点活泼，不夸张。' : 'A warm miniature clay storybook illustration for a preschool task card: a small orange fox watering one green potted plant with a blue watering can. Clear simple action, soft cream background, rounded shapes, mint and peach palette, no text, no letters, no frame, no interface.'});
    const data = result.audio || result.image;
    const path = `evidence/minimax-${operation}.${operation === 'design' ? 'mp3' : 'jpg'}`;
    writeFileSync(path, Buffer.from(data.split(',')[1], 'base64'));
    evidence[operation] = {ok: true, voiceId: result.voiceId, bytes: Buffer.from(data.split(',')[1], 'base64').length, file: path};
    if (result.voiceId) {
      const activation = await invokeMiniMax({operation: 'speech', voice: result.voiceId, text: '你今天有十八颗星星。洗洗小手可以获得三颗星星，完成后请家长确认哦。'});
      writeFileSync('evidence/minimax-designed-voice.mp3', Buffer.from(activation.audio.split(',')[1], 'base64'));
      evidence.design.activated = true;
    }
  } catch (error) { evidence[operation] = {ok: false, error: error.message}; }
  console.log(JSON.stringify({operation, ...evidence[operation]}));
}
writeFileSync('evidence/minimax-creative-probe.json', JSON.stringify(evidence, null, 2));
