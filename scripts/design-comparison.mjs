import sharp from 'sharp';
const width=1586,height=992;
const left=await sharp('design/selected-home.png').resize(width,height,{fit:'contain'}).png().toBuffer();
const right=await sharp('evidence/home-final.png').resize(width,height,{fit:'contain'}).png().toBuffer();
await sharp({create:{width:width*2+24,height:height+44,channels:4,background:'#f4ead6'}}).composite([
{input:Buffer.from('<svg width="3196" height="44"><text x="20" y="29" font-size="22" fill="#725739">Selected design</text><text x="1630" y="29" font-size="22" fill="#725739">Working implementation</text></svg>'),top:0,left:0},
{input:left,top:44,left:0},{input:right,top:44,left:width+24}
]).png().toFile('evidence/design-comparison.png');
