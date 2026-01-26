/* script.js — الإصدار 2.0 المتكامل مع إصلاحات */
const $ = sel => document.querySelector(sel);
const $all = sel => Array.from(document.querySelectorAll(sel));

/* notifier - مركزية */
const notifier = {
  show(msg, type='info', time=2200){
    const existing = document.querySelector('.gt-notification'); 
    if(existing) existing.remove();
    
    const n = document.createElement('div'); 
    n.className='gt-notification'; 
    n.dataset.type=type; 
    
    // إضافة أيقونة حسب النوع
    let icon = '💡';
    if(type === 'success') icon = '✅';
    if(type === 'error') icon = '❌';
    if(type === 'warning') icon = '⚠️';
    
    n.innerHTML = `<span style="font-size:1.2rem">${icon}</span><span>${msg}</span>`;
    
    document.body.appendChild(n);
    
    setTimeout(()=>n.classList.add('visible'),20); 
    setTimeout(()=>{ 
      n.classList.remove('visible'); 
      setTimeout(()=>n.remove(),300); 
    }, time);
  }
};

/* marked default options */
if(typeof marked !== 'undefined') marked.setOptions({ 
  gfm:true, 
  tables:true, 
  breaks:true, 
  headerIds:true, 
  mangle:false, 
  smartLists:true,
  smartypants: true
});

/* FontManager - معدّل للعمل بدون إنترنت */
const FONT_EXTENSIONS = ['.woff2','.woff','.ttf','.otf'];
class FontManager {
  constructor(selectEl, importBtn){
    this.selectEl = selectEl; 
    this.importBtn = importBtn; 
    this.loaded = new Map(); 
    this.init();
  }
  
  init(){
    if(this.importBtn && window.showDirectoryPicker) {
      this.importBtn.addEventListener('click', ()=>this.pickDirectory());
    }
    else if(this.importBtn) {
      this.importBtn.addEventListener('click', ()=>notifier.show('استخدم fonts.json أو ضع ملفات الخطوط في مجلد fonts/','info'));
    }
    
    this.loadDefaultFonts();
    
    if(this.selectEl){
      this.selectEl.addEventListener('change', ()=>{
        const v = this.selectEl.value;
        this.applyFont(v);
        localStorage.setItem('gt-markdawin-font', v);
        notifier.show(`تم تغيير الخط إلى ${v}`, 'success', 1500);
      });
      
      const saved = localStorage.getItem('gt-markdawin-font');
      if(saved) {
        setTimeout(()=>{ 
          if([...this.selectEl.options].some(o=>o.value===saved)) { 
            this.selectEl.value=saved; 
            this.applyFont(saved);
          } 
        }, 800);
      }
    }
  }
  
  applyFont(fontName){
    if(fontName==='__system__') {
      document.documentElement.style.removeProperty('--app-font');
      document.body.style.fontFamily = '';
    } else if(fontName === 'system-ui') {
      document.documentElement.style.setProperty('--app-font', 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');
      document.body.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    } else {
      document.documentElement.style.setProperty('--app-font', `"${fontName}", 'Amiri', system-ui`);
      document.body.style.fontFamily = `"${fontName}", 'Amiri', system-ui`;
    }
    
    // تحديث المعاينة أيضاً
    const preview = $('#preview');
    if(preview) {
      preview.style.fontFamily = document.body.style.fontFamily;
    }
  }
  
  async pickDirectory(){ 
    try{ 
      const dirHandle = await window.showDirectoryPicker(); 
      const fonts=[];
      for await(const entry of dirHandle.values()){ 
        if(entry.kind==='file' && FONT_EXTENSIONS.some(ext=>entry.name.toLowerCase().endsWith(ext))){ 
          const file = await entry.getFile(); 
          const url = URL.createObjectURL(file); 
          fonts.push({name:this.nameFrom(entry.name), url}); 
        } 
      } 
      if(fonts.length) this.applyFonts(fonts); 
      else notifier.show('لم يتم العثور على خطوط','info');
    }catch(e){ 
      notifier.show('تم إلغاء الوصول للمجلد','error'); 
    } 
  }
  
  loadDefaultFonts(){ 
    // خطوط افتراضية تعمل بدون إنترنت
    const defaultFonts = [
      {name: 'افتراضي النظام', value: '__system__'},
      {name: 'Amiri (خط عربي)', value: 'Amiri'},
      {name: 'Scheherazade', value: 'Scheherazade'},
      {name: 'Arial', value: 'Arial'},
      {name: 'خط النظام', value: 'system-ui'}
    ];
    
    defaultFonts.forEach(font => {
      if(this.selectEl && ![...this.selectEl.options].some(o=>o.value===font.value)){ 
        const o=document.createElement('option'); 
        o.value=font.value; 
        o.textContent=font.name; 
        this.selectEl.appendChild(o); 
      }
    });
    
    // محاولة تحميل الخطوط المحلية إذا وجدت
    this.tryLoadLocalFonts();
  }
  
  async tryLoadLocalFonts(){
    try {
      const response = await fetch('fonts.json');
      if(response.ok){
        const fonts = await response.json();
        if(Array.isArray(fonts)){
          fonts.forEach(font => {
            if(this.selectEl && ![...this.selectEl.options].some(o=>o.value===font)){
              const option = document.createElement('option');
              option.value = font;
              option.textContent = this.nameFrom(font);
              this.selectEl.appendChild(option);
            }
          });
        }
      }
    } catch(e) {
      // لا بأس إذا لم يوجد ملف fonts.json
      console.log('ملف fonts.json غير موجود، استخدام الخطوط الافتراضية');
    }
  }
  
  nameFrom(filename){ 
    const n = filename.split('/').pop().replace(/\.[^.]+$/,''); 
    return n.replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim(); 
  }
  
  applyFonts(list){ 
    let added=0; 
    const styleId='gt-dynamic-fonts'; 
    let style=document.getElementById(styleId); 
    if(!style){ 
      style=document.createElement('style'); 
      style.id=styleId; 
      document.head.appendChild(style); 
    } 
    
    list.forEach(item=>{ 
      if(this.loaded.has(item.name)) return; 
      const ext = item.url.split('.').pop().toLowerCase(); 
      const fmt = ext==='woff2'?'woff2':(ext==='woff'?'woff':(ext==='ttf'?'truetype':'opentype')); 
      const rule = `@font-face{ font-family: "${item.name}"; src: url("${item.url}") format("${fmt}"); font-display: swap; }`; 
      style.appendChild(document.createTextNode(rule)); 
      this.loaded.set(item.name,item.url); 
      
      if(this.selectEl && ![...this.selectEl.options].some(o=>o.value===item.name)){ 
        const o=document.createElement('option'); 
        o.value=item.name; 
        o.textContent=item.name; 
        this.selectEl.appendChild(o); 
      } 
      added++; 
    }); 
    
    if(added) notifier.show(`تم إضافة ${added} خطًا جديدًا`, 'success'); 
  }
}

/* EmojiManager - مع أعلام الدول */
class EmojiManager {
  constructor(panelEl, toggleBtn){
    this.panel = panelEl; 
    this.toggleBtn = toggleBtn; 
    this.emojis = []; 
    this.lastKey = ''; 
    this.init();
  }
  
  init(){
    if(!this.panel || !this.toggleBtn) return;
    
    this.toggleBtn.addEventListener('click', e=>{ 
      e.stopPropagation(); 
      this.panel.classList.toggle('hidden'); 
      const rect = this.toggleBtn.getBoundingClientRect(); 
      this.panel.style.position='fixed'; 
      const top = rect.bottom + window.scrollY + 8; 
      let left = rect.left + window.scrollX; 
      if((left + this.panel.offsetWidth) > window.innerWidth) {
        left = Math.max(8, window.innerWidth - this.panel.offsetWidth - 8); 
      }
      this.panel.style.top = `${top}px`; 
      this.panel.style.left = `${left}px`; 
      this.panel.style.zIndex = '9999';
      
      if(!this.panel.classList.contains('hidden')) {
        this.loadEmojisWithFlags();
      }
    });
    
    document.addEventListener('click', e=>{ 
      if(!this.panel.classList.contains('hidden') && 
         !this.panel.contains(e.target) && 
         e.target !== this.toggleBtn) {
        this.panel.classList.add('hidden'); 
      } 
    });
  }
  
  loadEmojisWithFlags(){
    const staticEmojis = [
      '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇',
      '🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚',
      '😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩',
      '🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣',
      '😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬',
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
      '❣️','💕','💞','💓','💗','💖','💘','💝','💟',
      '👋','🤚','🖐️','✋','🖖','👌','🤏','✌️','🤞','🤟',
      '🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎',
      '✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏',
      '⭐','🌟','✨','⚡','💥','🔥','💧','💦','☀️','🌙',
      '🌈','🌊','🎉','🎊','🎁','🎈','🎀','🎄','🎃','🎂',
      '🍎','🍕','🍦','☕','🎵','🎸','⚽','🎮','📱','💻',
      '📚','✏️','📎','🔗','💡','🔑','💰','💎','🎯','🏆',
      '✅','✔️','❌','❎','➡️','⬅️','⬆️','⬇️','↗️','↘️',
      '↙️','↖️','↔️','↩️','↪️','⤴️','⤵️','🔃','🔄','🔙',
      '🔚','🔛','🔜','🔝','🔀','🔁','🔂','▶️','⏩','⏪',
      '⏫','⏬','⏸️','⏹️','⏺️','🔅','🔆','📶','🔰','♻️',
      '☪️','🕋','🕌','🕍','📿','🕯️','📖','✒️','🖥️','⌨️',
      '🖱️','🖨️','💾','💿','📀','📡','🛰️','🔌','🔋','⚙️',
      '🛠️','🛡️','🔒','🔓','🤖','🧠','🦾','📊','📈','📉',
      '📁','📂','🔍','🛸','👾','🕹️','🐪','🌴','🌯','🥙',
      '🥘','🍲','🥗','🍯','🫖','👳','🧕','🏰','🏜️','🧿',
      '🪔','🏙️','🌃','🏺','🫠','🫢','🫣','🫡','🫥','🫤',
      '🥹','🚀','🌍','🗺️','🗾','🏔️','⛰️','🌋','🗻','🏕️',
      '🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🏘️','🏙️','🏚️',
      '🕌','🛕','🕍','⛩️','🕋','🏢','🏬','🏣','🏤','🏥',
      '🏦','🏨','🏪','🏫','🏩','💒','🏛️','⛪','🕌','🕍',
      // أعلام الدول العربية والإسلامية
      '🇸🇦','🇦🇪','🇶🇦','🇰🇼','🇧🇭','🇴🇲','🇾🇪','🇮🇶','🇯🇴',
      '🇱🇧','🇸🇾','🇵🇸','🇲🇦','🇩🇿','🇹🇳','🇱🇾','🇸🇩','🇪🇬',
      '🇸🇴','🇩🇯','🇰🇲','🇲🇷','🇹🇷','🇵🇰','🇦🇫','🇮🇷','🇦🇿',
      '🇹🇲','🇺🇿','🇰🇿','🇰🇬','🇹🇯','🇸🇳','🇳🇪','🇲🇱','🇬🇳',
      '🇨🇮','🇧🇫','🇹🇬','🇧🇯','🇲🇺','🇲🇷','🇸🇸','🇪🇷','🇩🇿',
      '🇲🇦','🇹🇳','🇱🇾','🇸🇩','🇪🇹','🇸🇴','🇩🇯','🇰🇪','🇹🇿',
      '🇺🇬','🇷🇼','🇧🇮','🇨🇩','🇨🇬','🇨🇲','🇬🇦','🇬🇶','🇬🇼',
      '🇸🇹','🇲🇿','🇲🇼','🇿🇲','🇿🇼','🇳🇦','🇧🇼','🇱🇸','🇸🇿',
      '🇲🇺','🇸🇨','🇰🇲','🇲🇻','🇲🇷','🇸🇳','🇬🇲','🇬🇼','🇬🇳',
      '🇸🇱','🇱🇷','🇨🇮','🇬🇭','🇳🇬','🇹🇬','🇧🇯','🇳🇪','🇧🇫',
      '🇲🇱','🇨🇫','🇹🇩','🇪🇷','🇩🇯','🇸🇴','🇰🇪','🇺🇬','🇷🇼',
      '🇧🇮','🇨🇩','🇨🇬','🇨🇲','🇬🇦','🇬🇶','🇸🇹','🇲🇿','🇲🇼',
      '🇿🇲','🇿🇼','🇳🇦','🇧🇼','🇱🇸','🇸🇿','🇸🇨','🇲🇻','🇰🇲',
      // رموز إسلامية
      '☪️','🕋','🕌','🕍','📿','🕯️','📖','🕌','🕋','☪️',
      '🕌','🕋','📿','🕯️','📖','🕌','🕋','☪️','🕌','🕋',
      '📿','🕯️','📖','🕌','🕋','☪️','🕌','🕋','📿','🕯️',
      '📖','🕌','🕋','☪️','🕌','🕋','📿','🕯️','📖','🕌',
      '🕋','☪️','🕌','🕋','📿','🕯️','📖','🕌','🕋','☪️',
      '🕌','🕋','📿','🕯️','📖','🕌','🕋','☪️','🕌','🕋'
    ];
    
    this.apply(staticEmojis);
  }
  
  apply(emojisList){
    const key = emojisList.join('|');
    if(key === this.lastKey) return;
    
    this.lastKey = key; 
    this.emojis = emojisList;
    this.panel.innerHTML = '';
    
    const grid = document.createElement('div'); 
    grid.className = 'emoji-grid';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
      gap: 6px;
      padding: 12px;
      max-height: 300px;
      overflow-y: auto;
    `;
    
    emojisList.forEach(emoji=>{
      const btn = document.createElement('button'); 
      btn.type='button'; 
      btn.className='emoji-item'; 
      btn.textContent=emoji; 
      btn.title=emoji;
      btn.style.cssText = `
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 1.4rem;
        padding: 6px;
        border-radius: 8px;
        transition: all 0.2s;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      btn.addEventListener('mouseenter', () => {
        btn.style.background='rgba(56, 163, 255, 0.2)';
        btn.style.transform='scale(1.1)';
        btn.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)';
      });
      
      btn.addEventListener('mouseleave', () => {
        btn.style.background='transparent';
        btn.style.transform='scale(1)';
        btn.style.boxShadow='none';
      });
      
      btn.addEventListener('click', ()=>{
        insertAtCursor(` ${emoji} `); 
        notifier.show('تم إدراج رمز تعبيري','success',700); 
        this.panel.classList.add('hidden'); 
      });
      
      grid.appendChild(btn);
    });
    
    this.panel.appendChild(grid);
  }
}

/* insertAtCursor */
function insertAtCursor(text){
  const ta = $('#editor'); 
  if(!ta) return; 
  const start = ta.selectionStart || 0; 
  const end = ta.selectionEnd || 0; 
  ta.setRangeText(text, start, end, 'end'); 
  ta.focus(); 
  ta.dispatchEvent(new Event('input',{bubbles:true}));
}

/* GTMarkdaWin application v2.0 */
class GTMarkdaWin {
  constructor(){
    this.editor = $('#editor'); 
    this.preview = $('#preview'); 
    this.fontSelector = $('#fontSelector'); 
    this.importFontsBtn = $('#importFontsBtn');
    this.emojiPanel = $('#emojiPanel'); 
    this.emojiHeaderBtn = $('#emojiBtnHeader');
    this.isPreviewVisible = true; 
    this.theme='dark';
    this.isEditorSyncing=false; 
    this.isPreviewSyncing=false;
    this.isSyncEnabled = true;
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;
    this.init();
  }

  init(){
    if(typeof marked==='undefined'){ 
      setTimeout(()=>{ 
        if(typeof marked==='undefined') {
          notifier.show('مكتبة marked غير محملة','error'); 
        } else {
          this.afterMarked(); 
        }
      },300); 
      return; 
    }
    this.afterMarked();
  }

  afterMarked(){
    this.bindUI();
    this.fontManager = this.fontSelector ? new FontManager(this.fontSelector, this.importFontsBtn) : null;
    if(this.emojiPanel && this.emojiHeaderBtn) this.emojiManager = new EmojiManager(this.emojiPanel, this.emojiHeaderBtn);
    this.loadSaved();
    this.updatePreview = this._debounce(()=>this._updatePreview(), 180);
    this.saveToStorage = this._debounce(()=>this._saveToStorage(), 300);
    this.saveToHistory = this._debounce(()=>this._saveToHistory(), 500);
    this._updatePreview();
    this.updateStats();
    this.updateSyncButton();
    this.loadLocalLogo();
    notifier.show('GT-MARKDAWIN v2.0 جاهز للكتابة 🎉','success',1200);
  }

  bindUI(){
    $all('.toolbar-btn').forEach(btn=>btn.addEventListener('click', ()=>this.executeCommand(btn.dataset.cmd)));
    
    if(this.editor){
      this.editor.addEventListener('input', ()=>{ 
        this.updatePreview(); 
        this.saveToStorage(); 
        this.saveToHistory();
        this.updateStats(); 
      });
      
      this.editor.addEventListener('keydown', (e)=>{
        // تراجع وإعادة
        if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){
          if(!e.shiftKey) {
            e.preventDefault();
            this.undo();
          }
        }
        if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='z'){
          e.preventDefault();
          this.redo();
        }
        if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){
          e.preventDefault();
          this.redo();
        }
        
        // اختصارات أخرى
        if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='b'){ 
          e.preventDefault(); 
          this.executeCommand('bold'); 
        } 
        if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='i'){ 
          e.preventDefault(); 
          this.executeCommand('italic'); 
        } 
        if(e.key==='Tab'){ 
          e.preventDefault(); 
          insertAtCursor('    '); 
        } 
      });
    }
    
    if($('#themeToggle')) $('#themeToggle').addEventListener('click', ()=>this.toggleTheme());
    if($('#fullscreenToggle')) $('#fullscreenToggle').addEventListener('click', ()=>this.toggleFullscreen());
    if($('#dirToggle')) $('#dirToggle').addEventListener('click', ()=>this.toggleDirection());
    if($('#clearBtn')) $('#clearBtn').addEventListener('click', ()=>this.clearEditor());
    if($('#exportHtml')) $('#exportHtml').addEventListener('click', ()=>this.exportHTML());
    if($('#exportPdf')) $('#exportPdf').addEventListener('click', ()=>this.exportPDF());
    
    if($('#syncToggle')) $('#syncToggle').addEventListener('click', ()=>this.toggleSync());
    
    if($('#saveBtn')) $('#saveBtn').addEventListener('click', ()=>this.exportMarkdown());
    if($('#loadBtn')) $('#loadBtn').addEventListener('click', ()=>this.importFileToPreview());
    
    // تراجع وإعادة
    if($('#undoBtn')) $('#undoBtn').addEventListener('click', ()=>this.undo());
    if($('#redoBtn')) $('#redoBtn').addEventListener('click', ()=>this.redo());
    
    // modals
    if($('#insertLink')) $('#insertLink').addEventListener('click', ()=>this.insertLink());
    if($('#cancelLink')) $('#cancelLink').addEventListener('click', ()=>this.hideModal('linkModal'));
    if($('#insertImage')) $('#insertImage').addEventListener('click', ()=>this.insertImage());
    if($('#cancelImage')) $('#cancelImage').addEventListener('click', ()=>this.hideModal('imageModal'));
    if($('#insertVideo')) $('#insertVideo').addEventListener('click', ()=>this.insertVideo());
    if($('#cancelVideo')) $('#cancelVideo').addEventListener('click', ()=>this.hideModal('videoModal'));
    if($('#insertAudio')) $('#insertAudio').addEventListener('click', ()=>this.insertAudio());
    if($('#cancelAudio')) $('#cancelAudio').addEventListener('click', ()=>this.hideModal('audioModal'));
    if($('#insertGif')) $('#insertGif').addEventListener('click', ()=>this.insertGif());
    if($('#cancelGif')) $('#cancelGif').addEventListener('click', ()=>this.hideModal('gifModal'));
    if($('#insertMath')) $('#insertMath').addEventListener('click', ()=>this.insertMath());
    if($('#cancelMath')) $('#cancelMath').addEventListener('click', ()=>this.hideModal('mathModal'));
    if($('#insertFootnote')) $('#insertFootnote').addEventListener('click', ()=>this.insertFootnote());
    if($('#cancelFootnote')) $('#cancelFootnote').addEventListener('click', ()=>this.hideModal('footnoteModal'));
    
    // focus buttons
    if($('#focusEditorBtn')) $('#focusEditorBtn').addEventListener('click', ()=>this.toggleFocus('editor'));
    if($('#focusPreviewBtn')) $('#focusPreviewBtn').addEventListener('click', ()=>this.toggleFocus('preview'));
    
    $all('.modal').forEach(m => m.addEventListener('click', (e)=>{ 
      if(e.target===m) this.hideModal(m.id); 
    }));
    
    // sync scroll
    if(this.editor) this.editor.addEventListener('scroll', ()=>this.syncScrollEditor());
    if(this.preview) this.preview.addEventListener('scroll', ()=>this.syncScrollPreview());
  }

  executeCommand(cmd){
    const ta = this.editor; 
    const start = ta.selectionStart; 
    const end = ta.selectionEnd; 
    const sel = ta.value.substring(start,end);
    
    const wrap=(before,after)=>{ 
      const replacement = sel ? before+sel+after : before+after; 
      ta.setRangeText(replacement, start, end, 'end'); 
      if(!sel){ 
        ta.selectionStart = start + before.length; 
        ta.selectionEnd = ta.selectionStart; 
      } 
      ta.focus(); 
      ta.dispatchEvent(new Event('input',{bubbles:true})); 
    };
    
    const prefixLine = (prefix)=>{ 
      const pos = ta.selectionStart; 
      const value = ta.value; 
      const lineStart = value.lastIndexOf('\n', pos-1) + 1; 
      ta.value = value.slice(0,lineStart) + prefix + value.slice(lineStart); 
      ta.selectionStart = ta.selectionEnd = pos + prefix.length; 
      ta.focus(); 
      ta.dispatchEvent(new Event('input',{bubbles:true})); 
    };
    
    const align = (a)=>{ 
      if(!sel){ 
        insertAtCursor(`<p style="text-align:${a};">\n</p>`); 
        ta.selectionStart -= 4; 
        ta.selectionEnd = ta.selectionStart; 
      } else {
        wrap(`<p style="text-align:${a};">\n${sel}\n</p>`,''); 
      }
    };
    
    switch(cmd){
      case 'undo': this.undo(); break;
      case 'redo': this.redo(); break;
      case 'bold': wrap('**','**'); break;
      case 'italic': wrap('*','*'); break;
      case 'strikethrough': wrap('~~','~~'); break;
      case 'code': wrap('`','`'); break;
      case 'codeblock': wrap('\n```\n','\n```\n'); break;
      case 'blockquote': prefixLine('> '); break;
      case 'hr': insertAtCursor('\n\n---\n\n'); break;
      case 'h1': prefixLine('# '); break;
      case 'h2': prefixLine('## '); break;
      case 'h3': prefixLine('### '); break;
      case 'h4': prefixLine('#### '); break;
      case 'h5': prefixLine('##### '); break;
      case 'h6': prefixLine('###### '); break;
      case 'ul': prefixLine('- '); break;
      case 'ol': prefixLine('1. '); break;
      case 'task': prefixLine('- [ ] '); break;
      case 'table':
        insertAtCursor('\n\n| ترويسة 1 | ترويسة 2 | ترويسة 3 |\n| :--- | :---: | ---: |\n| محتوى 1 | محتوى 2 | محتوى 3 |\n'); break;
      case 'link': this.showModal('linkModal'); break;
      case 'image': this.showModal('imageModal'); break;
      case 'video': this.showModal('videoModal'); break;
      case 'audio': this.showModal('audioModal'); break;
      case 'gif': this.showModal('gifModal'); break;
      case 'math': this.showModal('mathModal'); break;
      case 'footnote': this.showModal('footnoteModal'); break;
      case 'definition': 
        insertAtCursor('\n\n<dl>\n  <dt>مصطلح</dt>\n  <dd>تعريف المصطلح هنا</dd>\n</dl>\n'); 
        break;
      case 'align-left': align('left'); break;
      case 'align-center': align('center'); break;
      case 'align-right': align('right'); break;
      case 'superscript': wrap('<sup>','</sup>'); break;
      case 'subscript': wrap('<sub>','</sub>'); break;
      default: break;
    }
  }

  _updatePreview(){ 
    const md = this.editor.value; 
    if(!md.trim()){ 
      this.preview.innerHTML = '<p class="preview-empty">اكتب شيئًا ليعرض هنا...</p>'; 
      return; 
    } 
    try{ 
      let html = marked.parse(md);
      
      // تطبيق اتجاه النص على المعاينة
      const dir = document.body.getAttribute('dir') || 'rtl';
      this.preview.setAttribute('dir', dir);
      this.preview.style.direction = dir;
      this.preview.style.textAlign = dir === 'rtl' ? 'right' : 'left';
      
      // تطبيق الخط الحالي على المعاينة
      const currentFont = document.body.style.fontFamily || "'Amiri', system-ui";
      this.preview.style.fontFamily = currentFont;
      
      this.preview.innerHTML = html; 
    }catch(e){ 
      this.preview.innerHTML = '<p class="preview-error">⚠️ خطأ في تحويل الماركداون</p>'; 
      console.error(e); 
    } 
  }

  _debounce(fn, wait=200){ 
    let t=null; 
    return (...args)=>{ 
      clearTimeout(t); 
      t=setTimeout(()=>fn.apply(this,args), wait); 
    }; 
  }

  updateStats(){ 
    const text = this.editor.value; 
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const lines = text.split(/\n/).length;
    const dir = document.body.getAttribute('dir') || 'rtl';
    
    $('#wordCount').textContent = `الكلمات: ${words}`; 
    $('#charCount').textContent = `الحروف: ${chars}`; 
    $('#lineCount').textContent = `السطور: ${lines}`; 
    $('#currentDir').textContent = `الاتجاه: ${dir.toUpperCase()}`;
  }

  _saveToStorage(){ 
    localStorage.setItem('gt-markdawin-content', this.editor.value); 
  }

  _saveToHistory(){
    const currentContent = this.editor.value;
    
    // تجنب حفظ المحتوى المتكرر
    if(this.history[this.historyIndex] === currentContent) return;
    
    // إذا كنا في منتصف السجل، قم بقص نهاية السجل
    if(this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    // إضافة المحتوى الحالي إلى السجل
    this.history.push(currentContent);
    this.historyIndex++;
    
    // الحفاظ على حجم السجل
    if(this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  undo(){
    if(this.historyIndex > 0) {
      this.historyIndex--;
      this.editor.value = this.history[this.historyIndex];
      this.editor.dispatchEvent(new Event('input', {bubbles: true}));
      notifier.show('تم التراجع', 'info', 1000);
    }
  }

  redo(){
    if(this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.editor.value = this.history[this.historyIndex];
      this.editor.dispatchEvent(new Event('input', {bubbles: true}));
      notifier.show('تم الإعادة', 'info', 1000);
    }
  }

  loadSaved(){
    const s = localStorage.getItem('gt-markdawin-content'); 
    if(s && this.editor) {
      this.editor.value = s;
      this.history = [s];
      this.historyIndex = 0;
    }
    
    const savedTheme = localStorage.getItem('gt-markdawin-theme'); 
    if(savedTheme) this.theme=savedTheme; 
    document.documentElement.setAttribute('data-theme', this.theme);
    
    const t = $('#themeToggle'); 
    if(t) t.textContent = this.theme==='dark' ? '☀️' : '🌙';
    
    const savedFont = localStorage.getItem('gt-markdawin-font'); 
    if(savedFont && this.fontSelector) {
      setTimeout(()=>{ 
        if([...this.fontSelector.options].some(o=>o.value===savedFont)) { 
          this.fontSelector.value = savedFont; 
          if(this.fontManager) {
            this.fontManager.applyFont(savedFont);
          }
        } 
      },800);
    } else {
      // تطبيق الخط الافتراضي
      if(this.fontManager) {
        this.fontManager.applyFont('__system__');
      }
    }
    
    const savedDir = localStorage.getItem('gt-markdawin-dir'); 
    if(savedDir){
      document.documentElement.setAttribute('dir', savedDir); 
      document.body.setAttribute('dir', savedDir); 
      if(this.editor) this.editor.setAttribute('dir', savedDir); 
      if(this.preview) {
        this.preview.setAttribute('dir', savedDir);
        this.preview.style.direction = savedDir;
        this.preview.style.textAlign = savedDir === 'rtl' ? 'right' : 'left';
      }
    } else { 
      const defaultDir = document.documentElement.getAttribute('dir') || 'rtl';
      document.documentElement.setAttribute('dir', defaultDir); 
      document.body.setAttribute('dir', defaultDir); 
      if(this.editor) this.editor.setAttribute('dir', defaultDir); 
      if(this.preview) {
        this.preview.setAttribute('dir', defaultDir);
        this.preview.style.direction = defaultDir;
        this.preview.style.textAlign = defaultDir === 'rtl' ? 'right' : 'left';
      }
    }
    
    // تحميل حالة المزامنة
    const savedSync = localStorage.getItem('gt-markdawin-sync');
    this.isSyncEnabled = savedSync !== 'false';
  }

  loadLocalLogo() {
    const logo = document.querySelector('.app-logo');
    if (logo) {
      const localLogo = new Image();
      localLogo.onload = () => {
        logo.src = 'gt-markdawin-icon.png';
      };
      localLogo.onerror = () => {
        // شعار افتراضي إذا لم توجد الصورة
        logo.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAzNiAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE4IDBDOC4wNiAwIDAgOC4wNiAwIDE4QzAgMjcuOTQgOC4wNiAzNiAxOCAzNkMyNy45NCAzNiAzNiAyNy45NCAzNiAxOEMzNiA4LjA2IDI3Ljk0IDAgMTggMFoiIGZpbGw9IiMzOEEzRkYiLz4KPHBhdGggZD0iTTE4IDI3QzIyLjk3IDI3IDI3IDIyLjk3IDI3IDE4QzI3IDEzLjAzIDIyLjk3IDkgMTggOUMxMy4wMyA5IDkgMTMuMDMgOSAxOEM5IDIyLjk3IDEzLjAzIDI3IDE4IDI3WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTE4IDIzQzIwLjc2IDIzIDIzIDIwLjc2IDIzIDE4QzIzIDE1LjI0IDIwLjc2IDEzIDE4IDEzQzE1LjI0IDEzIDEzIDE1LjI0IDEzIDE4QzEzIDIwLjc2IDE1LjI0IDIzIDE4IDIzWiIgZmlsbD0iIzM4QTNGRiIvPgo8L3N2Zz4=';
      };
      localLogo.src = 'gt-markdawin-icon.png';
    }
  }

  showModal(id){ 
    const el=$(`#${id}`); 
    if(!el) return; 
    el.classList.remove('hidden'); 
    const input = el.querySelector('input, textarea, select'); 
    if(input) input.focus(); 
  }
  
  hideModal(id){ 
    const el=$(`#${id}`); 
    if(!el) return; 
    el.classList.add('hidden'); 
  }

  insertLink(){ 
    const text = $('#linkText').value || 'نص الرابط'; 
    const url = $('#linkUrl').value; 
    const title = $('#linkTitle').value;
    
    if(url){ 
      const titleAttr = title ? ` "${title}"` : '';
      insertAtCursor(`[${text}](${url}${titleAttr})`); 
      $('#linkText').value=''; 
      $('#linkUrl').value=''; 
      $('#linkTitle').value=''; 
      this.hideModal('linkModal'); 
      this.updatePreview(); 
      notifier.show('تم إدراج الرابط', 'success'); 
    } else {
      notifier.show('الرجاء إدخال رابط','error'); 
    }
  }
  
  insertImage(){ 
    const alt = $('#imageAlt').value || 'نص بديل'; 
    const url = $('#imageUrl').value; 
    const title = $('#imageTitle').value;
    
    if(url){ 
      const titleAttr = title ? ` "${title}"` : '';
      insertAtCursor(`![${alt}](${url}${titleAttr})`); 
      $('#imageAlt').value=''; 
      $('#imageUrl').value=''; 
      $('#imageTitle').value=''; 
      this.hideModal('imageModal'); 
      this.updatePreview(); 
      notifier.show('تم إدراج الصورة', 'success'); 
    } else {
      notifier.show('الرجاء إدخال رابط الصورة','error'); 
    }
  }

  insertVideo(){ 
    const url = $('#videoUrl').value; 
    const title = $('#videoTitle').value;
    const width = $('#videoWidth').value || 560;
    const height = $('#videoHeight').value || 315;
    
    if(url){ 
      const videoHtml = `<div class="video-container"><iframe width="${width}" height="${height}" src="${url}" title="${title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
      insertAtCursor(`\n\n${videoHtml}\n\n`); 
      $('#videoUrl').value=''; 
      $('#videoTitle').value=''; 
      $('#videoWidth').value='560'; 
      $('#videoHeight').value='315'; 
      this.hideModal('videoModal'); 
      this.updatePreview(); 
      notifier.show('تم إدراج الفيديو', 'success'); 
    } else {
      notifier.show('الرجاء إدخال رابط الفيديو','error'); 
    }
  }

  insertAudio(){ 
    const url = $('#audioUrl').value; 
    const alt = $('#audioAlt').value || 'ملف صوتي';
    const controls = $('#audioControls').value === 'true';
    
    if(url){ 
      const audioHtml = `<audio src="${url}" ${controls ? 'controls' : ''} alt="${alt}"></audio>`;
      insertAtCursor(`\n\n${audioHtml}\n\n`); 
      $('#audioUrl').value=''; 
      $('#audioAlt').value=''; 
      $('#audioControls').value='true'; 
      this.hideModal('audioModal'); 
      this.updatePreview(); 
      notifier.show('تم إدراج الملف الصوتي', 'success'); 
    } else {
      notifier.show('الرجاء إدخال رابط الملف الصوتي','error'); 
    }
  }

  insertGif(){ 
    const url = $('#gifUrl').value; 
    const alt = $('#gifAlt').value || 'صورة متحركة';
    
    if(url){ 
      insertAtCursor(`![${alt}](${url})`); 
      $('#gifUrl').value=''; 
      $('#gifAlt').value=''; 
      this.hideModal('gifModal'); 
      this.updatePreview(); 
      notifier.show('تم إدراج الصورة المتحركة', 'success'); 
    } else {
      notifier.show('الرجاء إدخال رابط GIF','error'); 
    }
  }

  insertMath(){ 
    const equation = $('#mathEquation').value; 
    const type = $('#mathType').value;
    
    if(equation){ 
      if(type === 'inline'){
        insertAtCursor(`$${equation}$`); 
      } else {
        insertAtCursor(`$$\n${equation}\n$$`); 
      }
      $('#mathEquation').value=''; 
      $('#mathType').value='inline'; 
      this.hideModal('mathModal'); 
      this.updatePreview(); 
      notifier.show('تم إدراج المعادلة الرياضية', 'success'); 
    } else {
      notifier.show('الرجاء إدخال معادلة','error'); 
    }
  }

  insertFootnote(){ 
    const id = $('#footnoteId').value || '1'; 
    const text = $('#footnoteText').value;
    
    if(text){ 
      insertAtCursor(`[^${id}]`); 
      
      // البحث عن الهوامش وإضافة الهامش الجديد
      const editorContent = this.editor.value;
      const footnotesMatch = editorContent.match(/\[\^(\d+)\]:/g);
      let maxId = 0;
      
      if(footnotesMatch) {
        footnotesMatch.forEach(fn => {
          const fnId = parseInt(fn.match(/\[\^(\d+)\]/)[1]);
          if(fnId > maxId) maxId = fnId;
        });
      }
      
      // إضافة الهامش في نهاية المستند
      const newFootnote = `\n[^${id}]: ${text}`;
      this.editor.value += newFootnote;
      
      $('#footnoteId').value=''; 
      $('#footnoteText').value=''; 
      this.hideModal('footnoteModal'); 
      this.updatePreview(); 
      notifier.show('تم إدراج الهامش', 'success'); 
    } else {
      notifier.show('الرجاء إدخال نص الهامش','error'); 
    }
  }

  toggleTheme(){ 
    this.theme = this.theme === 'dark' ? 'light' : 'dark'; 
    document.documentElement.setAttribute('data-theme', this.theme); 
    const t = $('#themeToggle'); 
    if(t) t.textContent = this.theme==='dark' ? '☀️' : '🌙'; 
    localStorage.setItem('gt-markdawin-theme', this.theme); 
    notifier.show(`السمة: ${this.theme === 'dark' ? 'داكن' : 'فاتح'}`, 'success', 1000);
  }
  
  toggleFullscreen(){ 
    if(!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e=>notifier.show(`خطأ: ${e.message}`,'error'));
      notifier.show('وضع ملء الشاشة مفعل', 'info');
    } else {
      document.exitFullscreen(); 
      notifier.show('وضع ملء الشاشة معطل', 'info');
    }
  }
  
  toggleDirection(){ 
    const cur = document.body.getAttribute('dir') || document.documentElement.getAttribute('dir') || 'rtl'; 
    const next = cur === 'rtl' ? 'ltr' : 'rtl'; 
    
    // تطبيق على جميع العناصر
    document.documentElement.setAttribute('dir', next); 
    document.body.setAttribute('dir', next); 
    if(this.editor) this.editor.setAttribute('dir', next); 
    if(this.preview) {
      this.preview.setAttribute('dir', next);
      this.preview.style.direction = next;
      this.preview.style.textAlign = next === 'rtl' ? 'right' : 'left';
    }
    
    localStorage.setItem('gt-markdawin-dir', next); 
    this.updateStats();
    notifier.show(`اتجاه النص: ${next === 'rtl' ? 'يمين إلى يسار' : 'يسار إلى يمين'}`,'success',1200); 
  }

  clearEditor(){ 
    if(confirm('هل أنت متأكد من رغبتك في مسح كل المحتوى؟')){ 
      this.editor.value=''; 
      this.editor.dispatchEvent(new Event('input',{bubbles:true})); 
      notifier.show('تم مسح المحتوى','info'); 
    } 
  }

  toggleFocus(target){
    const container = document.querySelector('.editor-container'); 
    if(!container) return;
    
    if(target==='editor'){
      if(container.classList.contains('editor-full')){
        container.classList.remove('editor-full'); 
        container.classList.add('split'); 
        
        document.querySelector('.preview-panel').style.display='flex'; 
        document.querySelector('.editor-panel').style.display='flex'; 
        document.querySelector('.editor-container').style.gridTemplateColumns='1fr 1fr'; 
        
        notifier.show('عاد العرض إلى الوضع المتساوي','info',900); 
      } else { 
        container.classList.remove('split','preview-full'); 
        container.classList.add('editor-full'); 
        
        document.querySelector('.preview-panel').style.display='none'; 
        document.querySelector('.editor-panel').style.display='flex'; 
        document.querySelector('.editor-container').style.gridTemplateColumns='1fr'; 
        
        notifier.show('المحرر الآن في وضع التكبير','success',900); 
      }
    } else if(target==='preview'){
      if(container.classList.contains('preview-full')){
        container.classList.remove('preview-full'); 
        container.classList.add('split'); 
        
        document.querySelector('.preview-panel').style.display='flex'; 
        document.querySelector('.editor-panel').style.display='flex'; 
        document.querySelector('.editor-container').style.gridTemplateColumns='1fr 1fr'; 
        
        notifier.show('عاد العرض إلى الوضع المتساوي','info',900); 
      } else { 
        container.classList.remove('split','editor-full'); 
        container.classList.add('preview-full'); 
        
        document.querySelector('.editor-panel').style.display='none'; 
        document.querySelector('.preview-panel').style.display='flex'; 
        document.querySelector('.editor-container').style.gridTemplateColumns='1fr'; 
        
        notifier.show('المعاينة الآن في وضع التكبير','success',900); 
      }
    }
  }

  toggleSync(){
    this.isSyncEnabled = !this.isSyncEnabled;
    localStorage.setItem('gt-markdawin-sync', this.isSyncEnabled);
    this.updateSyncButton();
    
    if(this.isSyncEnabled) {
      notifier.show('المزامنة مفعلة - التحريك متزامن', 'success', 1200);
    } else {
      notifier.show('المزامنة معطلة - التحريك مستقل', 'info', 1200);
    }
  }

  updateSyncButton(){
    const syncBtn = $('#syncToggle');
    if(syncBtn) {
      syncBtn.innerHTML = this.isSyncEnabled ? '🔗 مزامنة' : '🔓 منفصل';
      syncBtn.title = this.isSyncEnabled ? 'إيقاف مزامنة التحريك' : 'تفعيل مزامنة التحريك';
      syncBtn.classList.toggle('syncing', this.isSyncEnabled);
    }
  }

  importFileToPreview(){ 
    const input=document.createElement('input'); 
    input.type='file'; 
    input.accept='.html,.htm,.md,.txt,.markdown'; 
    input.onchange=(e)=>{ 
      const f=e.target.files[0]; 
      if(f){ 
        const r=new FileReader(); 
        r.onload=(ev)=>{ 
          const content = ev.target.result;
          
          if(f.name.endsWith('.html') || f.name.endsWith('.htm')) {
            // عرض HTML مباشرة في المعاينة
            this.preview.innerHTML = content;
            notifier.show(`تم فتح ${f.name} في المعاينة`,'success');
          } else {
            // عرض Markdown كمحتوى تحريري
            this.editor.value = content;
            this.editor.dispatchEvent(new Event('input',{bubbles:true}));
            notifier.show(`تم تحميل ${f.name}`,'success');
          }
        }; 
        r.readAsText(f); 
      } 
    }; 
    input.click(); 
  }

  _download(filename, text, type){ 
    const a=document.createElement('a'); 
    a.setAttribute('href', `data:${type};charset=utf-8,${encodeURIComponent(text)}`); 
    a.setAttribute('download', filename); 
    a.style.display='none'; 
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
    notifier.show(`تم حفظ ${filename}`,'success'); 
  }
  
  exportMarkdown(){ 
    const filename = `مستند-${this.getMoroccanDate()}.md`;
    this._download(filename, this.editor.value, 'text/markdown'); 
  }
  
  exportHTML(){ 
    const content=this.preview.innerHTML; 
    const fullHtml=`<!doctype html><html lang="ar" dir="${document.body.getAttribute('dir')||'rtl'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مستند GT-MARKDAWIN</title><style>${this.getPreviewStyles()}</style></head><body>${content}</body></html>`; 
    const filename = `مستند-${this.getMoroccanDate()}.html`;
    this._download(filename, fullHtml, 'text/html'); 
  }

  getPreviewStyles() {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: ${document.body.style.fontFamily || "'Amiri', 'Scheherazade', 'Noto Naskh Arabic', serif"};
        direction: ${document.body.getAttribute('dir') || 'rtl'};
        line-height: 1.8;
        color: #000;
        background: #fff;
        padding: 25mm;
        font-size: 14pt;
      }
      
      h1, h2, h3, h4, h5, h6 {
        color: #2c3e50;
        margin: 25px 0 15px 0;
        font-weight: 700;
      }
      
      p {
        margin: 15px 0;
        text-align: justify;
        line-height: 1.9;
      }
      
      a {
        color: #3498db;
        text-decoration: none;
      }
      
      ul, ol {
        margin: 15px 0;
        padding-right: 30px;
      }
      
      li {
        margin: 8px 0;
        line-height: 1.8;
      }
      
      blockquote {
        border-right: 4px solid #38a3ff;
        padding: 15px 20px;
        margin: 20px 0;
        background: #f8f9fa;
        border-radius: 8px;
        font-style: italic;
      }
      
      code {
        font-family: 'Courier New', monospace;
        background: #f1f3f4;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 12pt;
      }
      
      pre {
        font-family: 'Courier New', monospace;
        background: #2c3e50;
        color: #ecf0f1;
        padding: 15px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 20px 0;
        font-size: 12pt;
        line-height: 1.6;
        white-space: pre-wrap;
      }
      
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        font-size: 12pt;
      }
      
      th, td {
        border: 1px solid #ddd;
        padding: 10px 12px;
        text-align: ${document.body.getAttribute('dir') === 'rtl' ? 'right' : 'left'};
      }
      
      th {
        background: #f8f9fa;
        font-weight: bold;
        color: #2c3e50;
      }
      
      img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 15px auto;
        border-radius: 6px;
      }
      
      audio {
        width: 100%;
        margin: 15px 0;
      }
      
      hr {
        border: none;
        border-top: 2px solid #eee;
        margin: 30px 0;
      }
    `;
  }

  getMoroccanDate() {
    const now = new Date();
    const moroccoTime = new Date(now.getTime() + (1 * 60 * 60 * 1000));
    
    const year = moroccoTime.getFullYear();
    const month = String(moroccoTime.getMonth() + 1).padStart(2, '0');
    const day = String(moroccoTime.getDate()).padStart(2, '0');
    const hours = String(moroccoTime.getHours()).padStart(2, '0');
    const minutes = String(moroccoTime.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}_${hours}-${minutes}`;
  }

  getMoroccanDateFormatted() {
    const now = new Date();
    const moroccoTime = new Date(now.getTime() + (1 * 60 * 60 * 1000));
    
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    
    return new Intl.DateTimeFormat('ar', options).format(moroccoTime);
  }

  async exportPDF() {
    this._updatePreview();
    
    if (!this.preview || !this.preview.innerHTML.trim() || 
        this.preview.innerHTML.includes('preview-empty')) { 
      notifier.show('لا يوجد محتوى في المعاينة للتصدير.', 'error', 1600); 
      return; 
    }

    notifier.show('جارٍ تحضير PDF...', 'info', 2000);

    try {
      const printDate = this.getMoroccanDateFormatted();
      const currentFont = document.body.style.fontFamily || "'Amiri', system-ui";
      const currentDir = document.body.getAttribute('dir') || 'rtl';
      
      const printContent = `
<!DOCTYPE html>
<html dir="${currentDir}" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GT-MARKDAWIN - ${printDate}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: ${currentFont};
            direction: ${currentDir};
            line-height: 1.8;
            color: #000;
            background: #fff;
            padding: 25mm;
            font-size: 14pt;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #38a3ff;
        }
        
        .header h1 {
            color: #2c3e50;
            font-size: 28pt;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .header .subtitle {
            color: #7f8c8d;
            font-size: 14pt;
            margin-bottom: 15px;
        }
        
        .meta-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            color: #666;
            font-size: 11pt;
            border-bottom: 1px solid #eee;
            padding-bottom: 15px;
        }
        
        .content {
            margin-top: 20px;
        }
        
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin: 25px 0 15px 0;
            font-weight: 700;
        }
        
        h1 { font-size: 24pt; }
        h2 { font-size: 20pt; }
        h3 { font-size: 18pt; }
        h4 { font-size: 16pt; }
        h5 { font-size: 14pt; }
        h6 { font-size: 13pt; }
        
        p {
            margin: 15px 0;
            text-align: justify;
            line-height: 1.9;
        }
        
        a {
            color: #3498db;
            text-decoration: none;
        }
        
        ul, ol {
            margin: 15px 0;
            padding-right: 30px;
        }
        
        li {
            margin: 8px 0;
            line-height: 1.8;
        }
        
        blockquote {
            border-right: 4px solid #38a3ff;
            padding: 15px 20px;
            margin: 20px 0;
            background: #f8f9fa;
            border-radius: 8px;
            font-style: italic;
        }
        
        code {
            font-family: 'Courier New', monospace;
            background: #f1f3f4;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12pt;
        }
        
        pre {
            font-family: 'Courier New', monospace;
            background: #2c3e50;
            color: #ecf0f1;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 20px 0;
            font-size: 12pt;
            line-height: 1.6;
            white-space: pre-wrap;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 12pt;
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 10px 12px;
            text-align: ${currentDir === 'rtl' ? 'right' : 'left'};
        }
        
        th {
            background: #f8f9fa;
            font-weight: bold;
            color: #2c3e50;
        }
        
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 15px auto;
            border-radius: 6px;
        }
        
        audio {
            width: 100%;
            margin: 15px 0;
        }
        
        hr {
            border: none;
            border-top: 2px solid #eee;
            margin: 30px 0;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #7f8c8d;
            font-size: 10pt;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📝 GT-MARKDAWIN v2.0</h1>
        <div class="subtitle">مارك دَوِّنْ محرر عربي عصري</div>
    </div>
    
    <div class="meta-info">
        <div class="date">
            <strong>التاريخ:</strong> ${printDate}
        </div>
        <div class="direction">
            <strong>الاتجاه:</strong> ${currentDir === 'rtl' ? 'من اليمين لليسار' : 'من اليسار لليمين'}
        </div>
    </div>
    
    <div class="content">
        ${this.preview.innerHTML}
    </div>
    
    <div class="footer">
        <p>تم إنشاء هذا المستند بواسطة GT-MARKDAWIN v2.0</p>
        <p>${printDate}</p>
    </div>
</body>
</html>`;
      
      const printWindow = window.open('', '_blank');
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          setTimeout(() => {
            printWindow.close();
          }, 1000);
        }, 500);
      };
      
      notifier.show('✅ تم فتح نافذة الطباعة. اختر "حفظ كـ PDF"', 'success', 3000);
      
    } catch (error) {
      console.error('فشل تصدير PDF:', error);
      notifier.show('❌ فشل في تصدير PDF. حاول استخدام الطباعة من المتصفح.', 'error', 4000);
    }
  }

  _getScrollPercent(el){ 
    const h=el.scrollHeight - el.clientHeight; 
    return (h>0) ? (el.scrollTop/h) : 0; 
  }
  
  syncScrollEditor(){ 
    if(!this.isSyncEnabled) return;
    if(this.isPreviewSyncing){ 
      this.isPreviewSyncing=false; 
      return; 
    } 
    this.isEditorSyncing=true; 
    const p=this._getScrollPercent(this.editor); 
    const target=(this.preview.scrollHeight - this.preview.clientHeight)*p; 
    this.preview.scrollTop = target; 
  }
  
  syncScrollPreview(){ 
    if(!this.isSyncEnabled) return;
    if(this.isEditorSyncing){ 
      this.isEditorSyncing=false; 
      return; 
    } 
    this.isPreviewSyncing=true; 
    const p=this._getScrollPercent(this.preview); 
    const target=(this.editor.scrollHeight - this.editor.clientHeight)*p; 
    this.editor.scrollTop = target; 
  }
}

/* start */
document.addEventListener('DOMContentLoaded', ()=>{
  document.documentElement.setAttribute('data-theme','dark');
  window.app = new GTMarkdaWin();
});
