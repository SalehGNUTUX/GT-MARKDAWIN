/* script.js — GT-MARKDAWIN (النسخة النهائية الكاملة) */

/* ----- إعدادات ----- */
const FONT_EXTENSIONS = ['.woff2','.woff','.ttf','.otf'];

/* ----- اختصارات DOM ----- */
const $ = sel => document.querySelector(sel);
const $all = sel => Array.from(document.querySelectorAll(sel));

/* ----- إشعارات ----- */
const notifier = {
    show(msg, type='info', time=2200){
        const existing = document.querySelector('.gt-notification');
        if(existing) existing.remove();
        const n = document.createElement('div');
        n.className = 'gt-notification';
        n.dataset.type = type;
        n.textContent = msg;
        document.body.appendChild(n);
        setTimeout(()=> n.classList.add('visible'), 20);
        setTimeout(()=> { n.classList.remove('visible'); setTimeout(()=>n.remove(),300); }, time);
    }
};

/* ----- FontManager ----- */
class FontManager {
    constructor(selectEl, importBtn){
        this.selectEl = selectEl;
        this.importBtn = importBtn;
        this.loaded = new Map();
        this.init();
    }

    init(){
        if(this.importBtn && window.showDirectoryPicker){
            this.importBtn.addEventListener('click', ()=>this.pickDirectory());
        } else if(this.importBtn){
            // هذا هو الإشعار الذي رأيته. سيختفي إذا نجح تحميل fonts.json
            this.importBtn.addEventListener('click', ()=>notifier.show('متصفحك لا يدعم File System Access. استخدم fonts.json أو ضع الملفات في مجلد fonts/', 'info', 3500));
        }
        this.scanFonts(); // Scan from fonts.json first
        this.timer = setInterval(()=>this.scanFonts(), 15000); // Re-scan periodically

        this.selectEl.addEventListener('change', ()=>{
            const v = this.selectEl.value;
            if(v==='__system__') document.documentElement.style.removeProperty('--app-font');
            else document.documentElement.style.setProperty('--app-font', `"${v}", system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial`);
            localStorage.setItem('gt-markdawin-font', v);
        });

        const saved = localStorage.getItem('gt-markdawin-font');
        if(saved) setTimeout(()=>{ if([...this.selectEl.options].some(o=>o.value===saved)) { this.selectEl.value=saved; this.selectEl.dispatchEvent(new Event('change')); } }, 800);
    }

    async pickDirectory(){
        try{
            const dirHandle = await window.showDirectoryPicker();
            const fonts = [];
            for await(const entry of dirHandle.values()){
                if(entry.kind==='file' && FONT_EXTENSIONS.some(ext=>entry.name.toLowerCase().endsWith(ext))){
                    const file = await entry.getFile();
                    const url = URL.createObjectURL(file);
                    fonts.push({name:this.nameFrom(entry.name), url});
                }
            }
            if(fonts.length) this.applyFonts(fonts);
            else notifier.show('لم يتم العثور على خطوط داخل المجلد المختار.', 'info');
        } catch(e){
            console.warn('Directory picker cancelled or failed', e);
            notifier.show('لم تُمنح أذونات الوصول للمجلد أو تم الإلغاء.', 'error', 2000);
        }
    }

    async scanFonts(){
        try {
            // *** إصلاح: تم تغيير المسار من 'fonts/fonts.json' إلى 'fonts.json' ***
            const r = await fetch('fonts.json', {cache:'no-cache'});
            if(r.ok){
                const list = await r.json();
                if(Array.isArray(list) && list.length){
                    // هذا المنطق يفترض أن ملفات الخطوط موجودة في مجلد /fonts/
                    const fonts = list.map(f=>({name:this.nameFrom(f), url:`fonts/${f}`}));
                    this.applyFonts(fonts);
                    return; // توقف إذا تم العثور على fonts.json
                }
            }
        } catch(e){
            console.warn("Could not load fonts.json, falling back...", e);
        }

        // مسح احتياطي (كما كان في السكربت الأصلي)
        const common = ['Samim','Dubai-Regular','Dubai-Medium','Dubai-Light','Dubai-Bold','Consolas-Regular','UthmanicHafs1 Ver13','ArbFONTS-Amiri-Quran','amiri-quran','Ubuntu Arabic Regular','Ubuntu Arabic Bold','(A) Arslan Wessam A'];
        const candidates = [];
        for(const base of common){
            for(const ext of FONT_EXTENSIONS){
                const url = `fonts/${base}${ext}`;
                try{
                    const h = await fetch(url, {method:'HEAD'});
                    if(h.ok){ candidates.push({name:this.nameFrom(base+ext), url}); break; }
                } catch(e){}
            }
        }
        if(candidates.length) this.applyFonts(candidates);
    }

    nameFrom(filename){
        const n = filename.split('/').pop().replace(/\.[^.]+$/,'');
        return n.replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim();
    }

    applyFonts(list){
        let added=0;
        const styleId='gt-dynamic-fonts';
        let style=document.getElementById(styleId);
        if(!style){ style=document.createElement('style'); style.id=styleId; document.head.appendChild(style);}
        list.forEach(item=>{
            if(this.loaded.has(item.name)) return;
            const ext = item.url.split('.').pop().toLowerCase();
            const fmt = ext==='woff2'?'woff2':(ext==='woff'?'woff':(ext==='ttf'?'truetype':'opentype'));
            const rule=`@font-face { font-family: "${item.name}"; src: url("${item.url}") format("${fmt}"); font-weight: normal; font-style: normal; font-display: swap; }`;
            style.appendChild(document.createTextNode(rule));
            this.loaded.set(item.name,item.url);
            if(![...this.selectEl.options].some(o=>o.value===item.name)){
                const o=document.createElement('option'); o.value=item.name; o.textContent=item.name; this.selectEl.appendChild(o);
            }
            added++;
        });
        if(added) notifier.show(`تم إضافة ${added} خطًا جديدًا. اختره من القائمة.`, 'success', 2600);
        if(![...this.selectEl.options].some(o=>o.value==='__system__')){
            const o=document.createElement('option'); o.value='__system__'; o.textContent='افتراضي النظام'; this.selectEl.prepend(o);
        }
    }
}

/* ----- EmojiManager ----- */
class EmojiManager {
    constructor(panelEl, toggleBtn){
        this.panel=panelEl;
        this.toggleBtn=toggleBtn;
        this.emojis=[];
        this.lastKey='';
        this.init();
    }

    init(){
        if(!this.panel) return;
        this.toggleBtn.addEventListener('click', (e)=> {
            e.stopPropagation(); // منع معالج النقر على المستند
            this.panel.classList.toggle('hidden');
            const rect = this.toggleBtn.getBoundingClientRect();
            // تحديد موضع اللوحة بالنسبة للزر
            this.panel.style.top = (rect.bottom + 8)+'px';

            // تعديل يسار/يمين بناءً على عرض النافذة لمنع التجاوز
            if ((rect.left + this.panel.offsetWidth) > window.innerWidth) {
                this.panel.style.left = 'auto';
                this.panel.style.right = (window.innerWidth - rect.right) + 'px';
            } else {
                this.panel.style.left = rect.left+'px';
                this.panel.style.right = 'auto';
            }
        });
        document.addEventListener('click', (e)=>{
            if(!this.panel.classList.contains('hidden') && !this.panel.contains(e.target)) {
                this.panel.classList.add('hidden');
            }
        });

        this.scanEmojis();
        setInterval(()=>this.scanEmojis(), 15000);
    }

    async scanEmojis(){
        try{
            // *** إصلاح: تم تغيير المسار من 'emojis/list.json' إلى 'emojis.json' ***
            const r = await fetch('emojis.json', {cache:'no-cache'});
            if(r.ok){
                const list = await r.json();
                // *** إصلاح: تم تغيير المنطق لتحليل مصفوفة الكائنات واستخدام مسار 'svg' ***
                if (Array.isArray(list)) {
                    const items = list.map(f=>({name: f.name, url: f.svg}));
                    this.apply(items);
                    return;
                }
            }
        } catch(e){
            console.error("Error loading emojis.json", e);
        }
        // *** هذا هو الإشعار الذي رأيته ***
        this.panel.innerHTML='<div class="emoji-empty">فشل تحميل emojis.json</div>';
    }

    apply(list){
        const key=list.map(i=>i.url).join('|');
        if(key===this.lastKey) return;
        this.lastKey=key; this.emojis=list;
        this.panel.innerHTML='';
        if(!list.length){ this.panel.innerHTML='<div class="emoji-empty">لا توجد رموز في مجلد emojis/</div>'; return;}
        const grid=document.createElement('div'); grid.className='emoji-grid';
        list.forEach(item=>{
            const b=document.createElement('button'); b.className='emoji-item';
            b.title = item.name;
            const img=document.createElement('img'); img.src=item.url; img.alt=item.name; img.loading='lazy';
            b.appendChild(img);
            b.addEventListener('click', ()=>{
                // استخدم النص البديل (الاسم) كـ alt في الماركداون
                insertAtCursor(`![${item.name}](${item.url})`);
                notifier.show('تم إدراج رمز تعبيري','success',1200);
                this.panel.classList.add('hidden'); // إخفاء اللوحة بعد الاختيار
            });
            grid.appendChild(b);
        });
        this.panel.appendChild(grid);
    }
}

/* ----- محرر الماركداون ----- */
function insertAtCursor(text){
    const ta = $('#editor');
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;

    ta.setRangeText(text, start, end, 'end');

    ta.focus();
    // إطلاق الأحداث يدوياً لتحديث المعاينة والإحصائيات
    ta.dispatchEvent(new Event('input', { bubbles: true }));
}

/* ----- التطبيق الرئيسي ----- */
class GTMarkdaWin {
    constructor(){
        this.editor = $('#editor');
        this.preview = $('#preview');
        this.fontSelector = $('#fontSelector');
        this.importFontsBtn = $('#importFontsBtn');
        this.emojiPanel = $('#emojiPanel');
        this.emojiHeaderBtn = $('#emojiBtnHeader');
        this.isPreviewVisible=true;
        this.theme='dark';

        // *** إضافة: متغيرات قفل التمرير المتزامن ***
        this.isEditorSyncing = false;
        this.isPreviewSyncing = false;

        this.init();
    }

    init(){
        if(typeof marked==='undefined'){
            setTimeout(()=>{ if(typeof marked==='undefined') notifier.show('مكتبة marked غير محملة. تأكد من وجود marked.umd.js','error'); else this.afterMarked(); }, 300);
            return;
        }
        this.afterMarked();
    }

    afterMarked(){
        marked.setOptions({breaks:true, gfm:true, headerIds:true, mangle:false, smartLists:true});
        this.bindUI();
        this.fontManager = new FontManager(this.fontSelector, this.importFontsBtn);
        this.emojiManager = new EmojiManager(this.emojiPanel, this.emojiHeaderBtn);
        this.loadSaved();

        // عمليات Debounce للعمليات المكلفة
        this.updatePreview = this._debounce(()=>this._updatePreview(), 180);
        this.saveToStorage = this._debounce(()=>this._saveToStorage(), 300);

        this._updatePreview();
        this.updateStats();
        notifier.show('GT-MARKDAWIN جاهز 🎉','success',1600);
    }

    bindUI(){
        // شريط الأدوات
        $all('.toolbar-btn').forEach(btn=>btn.addEventListener('click', ()=>this.executeCommand(btn.dataset.cmd)));

        // المحرر
        this.editor.addEventListener('input', ()=>{
            this.updatePreview();
            this.saveToStorage();
            this.updateStats();
        });
        this.editor.addEventListener('keydown',(e)=>{
            if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='b'){ e.preventDefault(); this.executeCommand('bold'); }
            if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='i'){ e.preventDefault(); this.executeCommand('italic'); }
            // دعم مفتاح Tab للمسافة البادئة
            if(e.key === 'Tab') {
                e.preventDefault();
                insertAtCursor('    '); // 4 مسافات
            }
        });

        // *** إضافة: ربط جميع الأزرار المفقودة ***

        // الرأس
        $('#themeToggle').addEventListener('click', () => this.toggleTheme());
        $('#fullscreenToggle').addEventListener('click', () => this.toggleFullscreen());

        // لوحة المحرر
        $('#clearBtn').addEventListener('click', () => this.clearEditor());
        $('#importBtn').addEventListener('click', () => this.importFile());

        // لوحة المعاينة
        $('#exportHtml').addEventListener('click', () => this.exportHTML());
        // *** إصلاح: ربط الزر الذي تم نقله ***
        $('#togglePreview').addEventListener('click', (e) => this.togglePreview(e.target));

        // شريط الحالة
        $('#saveBtn').addEventListener('click', () => this.exportMarkdown());
        $('#loadBtn').addEventListener('click', () => this.importFile());

        // النوافذ المنبثقة (Modals)
        $('#insertLink').addEventListener('click', () => this.insertLink());
        $('#cancelLink').addEventListener('click', () => this.hideModal('linkModal'));
        $('#insertImage').addEventListener('click', () => this.insertImage());
        $('#cancelImage').addEventListener('click', () => this.hideModal('imageModal'));

        // إغلاق النوافذ عند النقر خارجها
        $all('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });

        // *** إضافة: ربط التمرير المتزامن ***
        this.editor.addEventListener('scroll', () => this.syncScrollEditor());
        this.preview.addEventListener('scroll', () => this.syncScrollPreview());
    }

    executeCommand(cmd){
        const ta = this.editor;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const sel = ta.value.substring(start,end);

        const wrap=(before,after)=>{
            const replacement = sel ? before+sel+after : before+after;
            ta.setRangeText(replacement,start,end,'end');
            if (!sel) {
                ta.selectionStart = start + before.length;
                ta.selectionEnd = ta.selectionStart;
            }
            ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true }));
        };

        const prefixLine=(prefix)=>{
            const pos = ta.selectionStart;
            const value = ta.value;
            const lineStart = value.lastIndexOf('\n', pos-1)+1;
            ta.value = value.slice(0,lineStart)+prefix+value.slice(lineStart);
            ta.selectionStart=ta.selectionEnd=pos+prefix.length;
            ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true }));
        };

        // مساعد المحاذاة
        const align = (alignment) => {
            if (!sel) {
                insertAtCursor(`<p style="text-align:${alignment};"></p>`);
                ta.selectionStart -= 4; // تحريك المؤشر داخل وسم p
                ta.selectionEnd = ta.selectionStart;
            } else {
                wrap(`<p style="text-align:${alignment};">\n${sel}\n</p>`, '');
            }
        };

        switch(cmd){
            case 'bold': wrap('**','**'); break;
            case 'italic': wrap('*','*'); break;
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

            // *** إضافة: الأوامر المفقودة ***
            case 'table':
                insertAtCursor('\n| ترويسة 1 | ترويسة 2 | ترويسة 3 |\n| :--- | :---: | ---: |\n| محتوى 1 | محتوى 2 | محتوى 3 |\n| محتوى 4 | محتوى 5 | محتوى 6 |\n');
                break;
            case 'link':
                this.showModal('linkModal');
                break;
            case 'image':
                this.showModal('imageModal');
                break;
            case 'align-left':
                align('left');
                break;
            case 'align-center':
                align('center');
                break;
            case 'align-right':
                align('right');
                break;
            default: break;
        }
    }

    _updatePreview(){
        const md=this.editor.value;
        if(!md.trim()){ this.preview.innerHTML='<p class="preview-empty">اكتب شيئًا ليعرض هنا...</p>'; return; }
        try{ this.preview.innerHTML=marked.parse(md); } catch(e){ this.preview.innerHTML='<p class="preview-error">⚠️ خطأ في تحويل الماركداون</p>'; console.error(e); }
    }

    _debounce(fn, wait=200){
        let t=null; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), wait); };
    }

    updateStats(){
        const text=this.editor.value;
        $('#wordCount').textContent=`الكلمات: ${text.trim()? text.trim().split(/\s+/).length:0}`;
        $('#charCount').textContent=`الحروف: ${text.length}`;
        $('#lineCount').textContent=`السطور: ${text.split(/\n/).length}`;
    }

    _saveToStorage(){
        localStorage.setItem('gt-markdawin-content', this.editor.value);
    }

    loadSaved(){
        const savedContent = localStorage.getItem('gt-markdawin-content');
        if (savedContent) this.editor.value = savedContent;

        // تحميل السمة المحفوظة
        const savedTheme = localStorage.getItem('gt-markdawin-theme');
        if (savedTheme) {
            this.theme = savedTheme;
        }
        // تطبيق السمة عند التحميل
        document.documentElement.setAttribute('data-theme', this.theme);
        $('#themeToggle').textContent = this.theme === 'dark' ? '☀️' : '🌙';
    }

    // *** إضافة: جميع الوظائف المساعدة المفقودة ***

    // --- وظائف النوافذ المنبثقة ---
    showModal(id) {
        $(`#${id}`).classList.remove('hidden');
        // التركيز على أول حقل إدخال
        $(`#${id}`).querySelector('input').focus();
    }
    hideModal(id) {
        $(`#${id}`).classList.add('hidden');
    }
    insertLink() {
        const text = $('#linkText').value || 'نص الرابط';
        const url = $('#linkUrl').value;
        if (url) {
            insertAtCursor(`[${text}](${url})`);
            $('#linkText').value = '';
            $('#linkUrl').value = '';
            this.hideModal('linkModal');
        } else {
            notifier.show('الرجاء إدخال رابط', 'error');
        }
    }
    insertImage() {
        const alt = $('#imageAlt').value || 'نص بديل';
        const url = $('#imageUrl').value;
        if (url) {
            insertAtCursor(`![${alt}](${url})`);
            $('#imageAlt').value = '';
            $('#imageUrl').value = '';
            this.hideModal('imageModal');
        } else {
            notifier.show('الرجاء إدخال رابط الصورة', 'error');
        }
    }

    // --- وظائف الرأس ---
    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.theme);
        $('#themeToggle').textContent = this.theme === 'dark' ? '☀️' : '🌙';
        localStorage.setItem('gt-markdawin-theme', this.theme);
    }
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                notifier.show(`خطأ: ${err.message}`, 'error');
            });
        } else {
            document.exitFullscreen();
        }
    }

    // --- وظائف لوحة المحرر/المعاينة ---
    clearEditor() {
        if (confirm('هل أنت متأكد من رغبتك في مسح كل المحتوى؟')) {
            this.editor.value = '';
            this.editor.dispatchEvent(new Event('input', { bubbles: true })); // إطلاق التحديثات
            notifier.show('تم مسح المحتوى', 'info');
        }
    }

    // *** إصلاح: وظيفة إظهار/إخفاء المعاينة ***
    togglePreview(btn) {
        const previewPanel = $('.preview-panel');
        this.isPreviewVisible = !this.isPreviewVisible;
        if (this.isPreviewVisible) {
            previewPanel.style.display = 'flex';
            $('.editor-container').style.gridTemplateColumns = '1fr 1fr';
            btn.textContent = 'إخفاء المعاينة';
        } else {
            previewPanel.style.display = 'none';
            $('.editor-container').style.gridTemplateColumns = '1fr';
            btn.textContent = 'إظهار المعاينة';
        }
    }

    // --- وظائف التعامل مع الملفات ---
    importFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md, .txt, .markdown';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (readEvent) => {
                    this.editor.value = readEvent.target.result;
                    this.editor.dispatchEvent(new Event('input', { bubbles: true })); // إطلاق التحديثات
                    notifier.show(`تم تحميل ${file.name}`, 'success');
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
    _download(filename, text, type) {
        const el = document.createElement('a');
        el.setAttribute('href', `data:${type};charset=utf-8,${encodeURIComponent(text)}`);
        el.setAttribute('download', filename);
        el.style.display = 'none';
        document.body.appendChild(el);
        el.click();
        document.body.removeChild(el);
        notifier.show(`تم حفظ ${filename}`, 'success');
    }
    exportMarkdown() {
        const content = this.editor.value;
        this._download('document.md', content, 'text/markdown');
    }
    exportHTML() {
        const content = this.preview.innerHTML;
        // غلاف HTML بسيط لتصدير قابل للقراءة
        const fullHtml = `<!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
        <meta charset="utf-8">
        <title>مستند مُصدّر</title>
        <style>
        body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif; line-height: 1.7; max-width: 800px; margin: 2rem auto; padding: 1rem; direction: rtl; }
        code { background: #f4f4f4; padding: 2px 5px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace; }
        pre { background: #f4f4f4; padding: 1rem; border-radius: 8px; overflow-x: auto; }
        pre code { padding: 0; background: none; }
        blockquote { border-right: 4px solid #ccc; padding-right: 1rem; margin-right: 0; color: #666; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
        th { background-color: #f2f2f2; }
        img { max-width: 100%; height: auto; border-radius: 8px; }
        hr { border: none; height: 1px; background-color: #ddd; margin: 2rem 0; }
        </style>
        </head>
        <body>
        ${content}
        </body>
        </html>`;
        this._download('document.html', fullHtml, 'text/html');
    }

    // *** إضافة: وظائف التمرير المتزامن ***

    // حساب النسبة المئوية للتمرير
    _getScrollPercent(el) {
        const h = el.scrollHeight - el.clientHeight;
        return (h > 0) ? (el.scrollTop / h) : 0;
    }

    syncScrollEditor() {
        if (this.isPreviewSyncing) {
            this.isPreviewSyncing = false; // فتح القفل
            return;
        }
        this.isEditorSyncing = true; // قفل المحرر
        const percent = this._getScrollPercent(this.editor);
        const targetScroll = (this.preview.scrollHeight - this.preview.clientHeight) * percent;
        this.preview.scrollTop = targetScroll;
    }

    syncScrollPreview() {
        if (this.isEditorSyncing) {
            this.isEditorSyncing = false; // فتح القفل
            return;
        }
        this.isPreviewSyncing = true; // قفل المعاينة
        const percent = this._getScrollPercent(this.preview);
        const targetScroll = (this.editor.scrollHeight - this.editor.clientHeight) * percent;
        this.editor.scrollTop = targetScroll;
    }
}

/* ----- بدء التشغيل ----- */
document.addEventListener('DOMContentLoaded', ()=>{
    // يتم تطبيق السمة الافتراضية، ثم ستقوم loadSaved() بتجاوزها
    document.documentElement.setAttribute('data-theme','dark');
    window.app = new GTMarkdaWin();
});
