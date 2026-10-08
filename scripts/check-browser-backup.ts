import {readFileSync,writeFileSync} from 'node:fs';
import {validateState,balance,available} from '../src/domain.ts';
const envelope=JSON.parse(readFileSync(process.argv[2],'utf8')),state=validateState(envelope.state);
const custom=state.tasks.filter(t=>t.image.startsWith('custom:'));
if(custom.length!==1||!state.recordings[custom[0].id]||balance(state)!==18)throw new Error('Custom media backup is incomplete.');
const report={version:envelope.version,balance:balance(state),available:available(state),customTasks:custom.length,imageBytes:state.illustrations[custom[0].image].length,voiceBytes:state.recordings[custom[0].id].length,conversation:state.settings.conversation,containsAPIKey:JSON.stringify(envelope).includes(process.env.MINIMAX_CN_API_KEY||'not-a-real-key')};
if(report.containsAPIKey)throw new Error('Credential must not be included in backups.');
writeFileSync('evidence/browser-custom-backup.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
