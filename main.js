(()=>{"use strict";const e=Math.random;var t,r;function s({u:e,v:t}){return t<e?`${t} ${e}`:`${e} ${t}`}function n(e){const t=e.split(" "),r=Number(t[0]),s=Number(t[1]);return{u:Math.min(r,s),v:Math.max(r,s)}}!function(e){e[e.None=0]="None",e[e.Player1=1]="Player1",e[e.Player2=-1]="Player2"}(t||(t={})),function(e){e.Player1="#dd4124",e.Player2="#2958db"}(r||(r={}));class o{constructor(e){this.adjacencyLists=new Map,this.vertexCount=0,this.edgeCount=0,e&&(e.adjacencyLists.forEach(((e,t)=>{const r=new Set;e.forEach((e=>r.add(e))),this.adjacencyLists.set(t,r)})),this.vertexCount=e.vertexCount,this.edgeCount=e.edgeCount)}addVertex(e){this.adjacencyLists.has(e)||(this.adjacencyLists.set(e,new Set),this.vertexCount++)}addEdge(e,t){const r=this.adjacencyLists.get(e),s=this.adjacencyLists.get(t);if(!r)throw new Error(`No vertex ${e} exists`);if(!s)throw new Error(`No vertex ${t} exists`);if(e==t)throw new Error("Cannot add a self-edge");this.hasEdge(e,t)||(r.add(t),s.add(e),this.edgeCount++)}getEdge(e,t){if(!this.hasEdge(e,t))throw new Error(`Edge ${e}, ${t} doesn't exist`);return{u:Math.min(e,t),v:Math.max(e,t)}}getEdgeIfExists(e,t){if(this.hasEdge(e,t))return{u:Math.min(e,t),v:Math.max(e,t)}}hasEdge(e,t){const r=this.adjacencyLists.get(e),s=this.adjacencyLists.get(t);return null!=r&&null!=s&&r.has(t)&&s.has(e)}removeEdgeIfExists(e,t){if(this.hasEdge(e,t))return this.removeEdge(e,t)}removeEdge(e,t){const r=this.adjacencyLists.get(e),s=this.adjacencyLists.get(t);if(!this.hasEdge(e,t)||!r||!s)throw new Error(`Edge ${e}-${t} doesn't exist`);return r.delete(t),s.delete(e),this.edgeCount--,e<t?{u:e,v:t}:{u:t,v:e}}neighbors(e){const t=this.adjacencyLists.get(e);if(!t)throw new Error(`${e} is not a vertex in the graph`);return t}degree(e){const t=this.adjacencyLists.get(e);if(!t)throw new Error(`${e} is not a vertex in the graph`);return t.size}vertices(){return this.adjacencyLists.keys()}*edges(){for(const[e,t]of this.adjacencyLists.entries())for(const r of t)e>r||(yield{u:e,v:r})}numberOfEdges(){return this.edgeCount}numberOfVertices(){return this.vertexCount}*bfs(e){const t=[e],r=new Set;for(;0!=t.length;){const e=t.shift();if(null!=e&&!r.has(e)){r.add(e);for(const s of this.neighbors(e))r.has(s)||t.unshift(s);yield e}}}*dfs(e){const t=[e],r=new Set;for(;0!=t.length;){const e=t.pop();if(null!=e&&!r.has(e)){r.add(e);for(const s of this.neighbors(e))r.has(s)||t.push(s);yield e}}}}class i extends o{constructor(e){if(super(e),this.innerNodes=new Set,this.outerNodes=new Set,this.degreeOneInnerNodes=new Set,this.rowFactor=10,this.edgeHash=0n,e)this.innerNodes=new Set(e.innerNodes),this.outerNodes=new Set(e.outerNodes),this.rowFactor=e.rowFactor;else{for(;this.rowFactor<Math.max(4,6);)this.rowFactor*=10;for(let e=1;e<=4;e++)for(let t=1;t<=6;t++){const r=e*this.rowFactor+t;this.innerNodes.add(r),this.addVertex(r)}for(let e=1;e<=6;e++){const t=0*this.rowFactor+e;this.outerNodes.add(t),this.addVertex(t)}for(let e=1;e<=6;e++){const t=5*this.rowFactor+e;this.outerNodes.add(t),this.addVertex(t)}for(let e=1;e<=4;e++){const t=e*this.rowFactor+0;this.outerNodes.add(t),this.addVertex(t)}for(let e=1;e<=4;e++){const t=e*this.rowFactor+7;this.outerNodes.add(t),this.addVertex(t)}for(const e of this.vertices()){if(this.outerNodes.has(e))continue;const t=Math.floor(e/this.rowFactor),r=e%this.rowFactor;[[t-1,r],[t,r+1],[t+1,r],[t,r-1]].forEach((([t,r])=>{const s=t*this.rowFactor+r;this.addEdge(e,s)}))}}this.edgeHash=this.computeHash(),this.degreeOneInnerNodes=this.computeDegreeOneInnerNodes()}computeDegreeOneInnerNodes(){const e=new Set;for(const t of this.vertices())this.isInnerNode(t)&&1==this.degree(t)&&e.add(t);return e}getDegreeOneInnerNodes(){return new Set(this.degreeOneInnerNodes)}getInnerNodes(){return[...this.innerNodes]}isInnerNode(e){return this.innerNodes.has(e)}isOuterNode(e){return this.outerNodes.has(e)}computeHash(){let e=0n;for(let t=i.EdgeIndex.length-1;t>=0;t--){const{u:r,v:s}=i.EdgeIndex[t];e<<=1n,e+=this.hasEdge(r,s)?1n:0n}return e}getEdgeHash(){return this.edgeHash}updateDegreeOneSet(e){this.isOuterNode(e)||(1==this.degree(e)?this.degreeOneInnerNodes.add(e):this.degreeOneInnerNodes.delete(e))}addEdge(e,t){super.addEdge(e,t);const r=1n<<BigInt(i.getEdgeIndex(e,t));this.edgeHash=this.edgeHash|r,this.updateDegreeOneSet(e),this.updateDegreeOneSet(t)}removeEdge(e,t){const r=super.removeEdge(e,t),s=1n<<BigInt(i.getEdgeIndex(e,t));return this.edgeHash=this.edgeHash&~s,this.updateDegreeOneSet(e),this.updateDegreeOneSet(t),r}static fromHash(e){const t=new i;let r=0;for(;e>0n;){if(!(1n&e)){const e=i.EdgeIndex[r];t.removeEdgeIfExists(e.u,e.v)}e>>=1n,r++}return t}static getEdgeIndex(e,t){return t<e?i.getEdgeIndex(t,e):t-e==10?6*Math.floor((e-1)/10)+(e-1)%10:30+7*(Math.floor(e/10)-1)+e%10}}i.EmptyHash=288230376151711743n,i.EdgeIndex=[{u:1,v:11},{u:2,v:12},{u:3,v:13},{u:4,v:14},{u:5,v:15},{u:6,v:16},{u:11,v:21},{u:12,v:22},{u:13,v:23},{u:14,v:24},{u:15,v:25},{u:16,v:26},{u:21,v:31},{u:22,v:32},{u:23,v:33},{u:24,v:34},{u:25,v:35},{u:26,v:36},{u:31,v:41},{u:32,v:42},{u:33,v:43},{u:34,v:44},{u:35,v:45},{u:36,v:46},{u:41,v:51},{u:42,v:52},{u:43,v:53},{u:44,v:54},{u:45,v:55},{u:46,v:56},{u:10,v:11},{u:11,v:12},{u:12,v:13},{u:13,v:14},{u:14,v:15},{u:15,v:16},{u:16,v:17},{u:20,v:21},{u:21,v:22},{u:22,v:23},{u:23,v:24},{u:24,v:25},{u:25,v:26},{u:26,v:27},{u:30,v:31},{u:31,v:32},{u:32,v:33},{u:33,v:34},{u:34,v:35},{u:35,v:36},{u:36,v:37},{u:40,v:41},{u:41,v:42},{u:42,v:43},{u:43,v:44},{u:44,v:45},{u:45,v:46},{u:46,v:47}];class a extends i{constructor(e){if(super(e),this.boxOwners=new Map,this.currentPlayer=t.Player1,this.player1Score=0,this.player2Score=0,this.moveLog=[],e)this.boxOwners=new Map(e.boxOwners),this.currentPlayer=e.currentPlayer,this.moveLog=[...e.moveLog],this.player1Score=e.player1Score,this.player2Score=e.player2Score;else for(const e of this.getInnerNodes())this.boxOwners.set(e,t.None)}static cleanFromGameGraph(e,r=t.Player1){const s=new a;for(const{u:t,v:r}of[...s.edges()])e.hasEdge(t,r)||s.removeEdge(t,r);return s.currentPlayer=r,s}getPlayer1Score(){return this.player1Score}getPlayer2Score(){return this.player2Score}getScoreDifference(){return this.player1Score-this.player2Score}getCurrentPlayer(){return this.currentPlayer}isPlayer1sTurn(){return this.getCurrentPlayer()==t.Player1}getUnclaimedEdges(){return[...this.edges()]}getUnclaimedEdgesThatDoNotCreateABox(){return[...this.edges()].filter((({u:e,v:t})=>(this.isOuterNode(e)||this.degree(e)>2)&&(this.isOuterNode(t)||this.degree(t)>2)))}getEdgesThatEitherCaptureABoxOrDoNotCreateABox(e){const t=[...this.edges()],r=t.filter((({u:e,v:t})=>this.isInnerNode(e)&&1==this.degree(e)||this.isInnerNode(t)&&1==this.degree(t)));if(e&&r.length>0)return r;const s=t.filter((({u:e,v:t})=>2!=this.degree(e)&&2!=this.degree(t)));return s.length>0?(r.push(...s),r):t}isEndGame(){for(const{u:e,v:t}of this.edges())if((this.isOuterNode(e)||this.degree(e)>2)&&(this.isOuterNode(t)||this.degree(t)>2))return!1;return!0}getBoxOwner(e){return this.boxOwners.get(e)}setBoxOwner(e,r){const s=this.boxOwners.get(e);if(null==s||s!=t.None&&r!=t.None)throw new Error(`Box ${e} either doesn't exist or is already taken`);s==t.Player1?this.player1Score--:s==t.Player2&&this.player2Score--,this.boxOwners.set(e,r),r==t.Player1?this.player1Score++:r==t.Player2&&this.player2Score++}*boxes(){for(const e of this.boxOwners.keys())yield e}*unownedBoxes(){for(const[e,r]of this.boxOwners)r==t.None&&(yield e)}*boxesAndOwners(){for(const[e,t]of this.boxOwners)yield[e,t]}makeMove(e){const t=[];let r=!1;for(const s of function*(e){if(Array.isArray(e))for(const t of e)yield t;else yield e}(e)){if(r)throw new Error("Move continues past completing no more boxes");const e=this.makeSingleMove(s);t.push(e),e.completedBox||(r=!0)}return t}makeSingleMove({u:e,v:t}){if(!this.hasEdge(e,t))throw new Error(`Illegal move: ${e}-${t}`);const r=this.removeEdge(e,t);let s=this.moveLog.length>0?this.moveLog[this.moveLog.length-1]:void 0;s&&s.player==this.currentPlayer||(s={player:this.currentPlayer,moves:[]},this.moveLog.push(s)),s.moves.push(r);let n=!1;this.isInnerNode(e)&&0==this.degree(e)&&(this.setBoxOwner(e,this.currentPlayer),n=!0),this.isInnerNode(t)&&0==this.degree(t)&&(this.setBoxOwner(t,this.currentPlayer),n=!0);const o={move:r,completedBox:n};return n||(this.currentPlayer=-this.currentPlayer),o}getWinner(){if(!this.isGameOver())return;let e=this.getScoreDifference();return e>0?t.Player1:e<0?t.Player2:t.None}isGameOver(){return 0==this.numberOfEdges()}revertMove(e){const t=function(e){return Array.isArray(e)?e:[e]}(e);for(let e=t.length-1;e>=0;e--){s=t[e],null==(r=this.revertSingleMove())||null==s||r.u==s.u&&r.v==s.v||r.u==s.v&&(r.v,s.u)}var r,s}revertEntirePlayerMove(){const e=this.moveLog.length;for(;this.moveLog.length==e;)this.revertSingleMove()}revertSingleMove(){const e=this.moveLog.pop();if(!e)throw new Error("No move to revert");const r=e.moves.pop();if(!r)throw new Error("no single move to remove");this.addEdge(r.u,r.v);const s=this.getBoxOwner(r.u),n=this.getBoxOwner(r.v);return null!=s&&s!=t.None&&this.setBoxOwner(r.u,t.None),null!=n&&n!=t.None&&this.setBoxOwner(r.v,t.None),this.currentPlayer=e.player,e.moves.length>0&&this.moveLog.push(e),r}moveLogLength(){return this.moveLog.length}getAllLegalMoves(){const e=new Set,t=new Set,r=[];for(const n of this.edges()){const o=s(n);if(t.has(o))continue;const i=this.degree(n.u),a=this.degree(n.v),h=this.isInnerNode(n.u)&&1==i?n.u:this.isInnerNode(n.v)&&1==a?n.v:void 0;if(null!=h){const o=[];let i=h;for(const e of this.dfs(h))if(e!=h){if(null!=i&&o.push({u:Math.min(i,e),v:Math.max(i,e)}),this.degree(e)>2)break;i=e}if(1==o.length){const r=s(n);e.add(r),t.add(r);continue}o.forEach((r=>{const n=s(r);e.delete(n),t.add(n)}));const a={fullCapture:o},d=2==this.degree(i),u=1==this.degree(i);if(d&&o.length>=2){const e=o.slice(0,-2);e.push(o[o.length-1]),a.handout=e}else if(u&&o.length>=5){const e=o.slice(0,-3);e.push(o[o.length-2]),a.handout=e}r.push(a)}else e.add(s(n))}if(r.length>=2)return r.map((({fullCapture:e})=>e));if(1==r.length){const e=[],t=r[0];e.push(t.fullCapture);const s=t.handout;return null!=s&&e.push(s),e}const o=[];for(const t of e)o.push(n(t));return o}getAllPlayedMoves(){return this.moveLog.flatMap((e=>e.moves))}getFullHash(){const e=BigInt(this.getScoreDifference()+24<<1|(this.isPlayer1sTurn()?0:1));return this.getEdgeHash()<<8n|e}}a.BoxIndex=[11,12,13,14,15,16,21,22,23,24,25,26,31,32,33,34,35,36,41,42,43,44,45,46];const h=new Worker("./worker.js");h.onmessage=()=>{};const d=new a;async function u(){await async function(e=!1){const s=document.getElementById("board");if(!s)return;const n=s.style.borderColor,o=null!=d.getWinner()?"#FFFFFF":d.getCurrentPlayer()==t.Player1?r.Player1:r.Player2;n!=o&&(s.style.borderColor=o,e||await new Promise((e=>setTimeout(e,500))))}(!0),await new Promise((e=>setTimeout(e,0)))}window.game=d;const c=new URLSearchParams(window.location.search);let l=t.Player1;const g=parseInt(c.get("human")??"1");l=isNaN(g)||1!=g&&2!=g&&-2!=g&&-1!=g||1==g?t.Player1:t.Player2;const v=!!c.get("debugHuman");let f=parseInt(c.get("fill")??"0");const y=[];function m(){if(f>0){let t;const r=d.getUnclaimedEdgesThatDoNotCreateABox();return t=r[Math.floor(e()*r.length)],f--,t}if(0!=y.length)return y.splice(0,1)[0]}async function w(e,r=0){const s=d.getCurrentPlayer();Array.isArray(e)||(e=[e]);for(let n=0;n<e.length;n++){const o=e[n];d.makeSingleMove(o);const i=`E${o.u}-${o.v}`,a=document.getElementById(i);if(!a)throw new Error(`${i} doesn't exist`);if(a.classList.add(s==t.Player1?"p1":"p2"),d.getBoxOwner(o.u)==s){const e=document.getElementById(`S${o.u}`);e?.classList.add(s==t.Player1?"p1":"p2")}if(d.getBoxOwner(o.v)==s){const e=document.getElementById(`S${o.v}`);e?.classList.add(s==t.Player1?"p1":"p2")}r>0&&n<e.length-1&&await new Promise((e=>setTimeout(e,1e3)))}}!async function(){for(await u();null==d.getWinner();){const e=m();if(d.getCurrentPlayer()==l||null!=e||v){const t=new Promise((t=>{if(null!=e)return void t(e);const r=new Map;for(const e of d.getUnclaimedEdges()){const s=s=>{r.forEach(((e,t)=>{const r=document.getElementById(t);r?.removeEventListener("click",e),r?.classList.remove("clickable")})),t(e)},n=`E${e.u}-${e.v}`;r.set(n,s);const o=document.getElementById(n);if(!o)throw new Error(`Edge ${n} element doesn't exist`);o.classList.add("clickable"),o.addEventListener("click",s)}})),r=await t;r&&await w(r),v&&(l=d.getCurrentPlayer())}else{const e=new Promise((e=>{h.onerror=e=>{console.error("Unexpected error",e)},h.onmessage=t=>{const r=t.data;e(r.move)},h.postMessage({game:{moves:d.getAllPlayedMoves()},currentPlayer:l==t.Player1?t.Player2:t.Player1})})),r=await e;r&&await w(r,1e3)}await u()}console.log("GAME OVER!"),await async function(){let e=0,r=0;for(const[s,n]of d.boxesAndOwners())if(n!=t.None){const o=document.getElementById(`S${s}`);o&&(o.textContent=""+(n==t.Player1?++e:++r),await new Promise((e=>setTimeout(e,100))))}}(),console.log("Move log:",d.getAllPlayedMoves().map((({u:e,v:t})=>`move(${e}, ${t})`)).join(","))}()})();