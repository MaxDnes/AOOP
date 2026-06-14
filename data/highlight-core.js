/* ============ SYNTAX HIGHLIGHTER · core (pure logic) ============
   Token-based, dependency-free highlighter for the code blocks rendered by
   app.js. Lives in its own Node-loadable module so the test suite can exercise
   it directly (app.js itself is not Node-loadable because it touches the DOM at
   load time).

     esc(s)              -> HTML-escaped string
     highlight(code,lang) -> highlighted HTML for csharp | xml | bash | json
                             (any other lang falls back to esc())

   How it works: each pass either STASHES a finished <span> (replacing it with an
   opaque ~S{n}Z~ placeholder) or writes markup directly. Anything written
   directly MUST be invisible to later passes, otherwise a later pass can match
   text *inside* the emitted markup and corrupt the HTML. That is exactly the bug
   this module was extracted to fix:

     - C#:  the number pass wrote `<span class="tk-num">5</span>` directly. The
            keyword pass then matched the word `class` (a C# keyword!) inside that
            attribute and split the tag, leaking `class="tk-num">5` onto the page.
     - bash: the keyword pass wrote `<span class="tk-kw">dotnet</span>` directly,
            then the flag pass `(--?[\w-]+)` matched `-kw` inside `tk-kw`.

   Both are fixed by stashing those spans so no later pass can see their markup.

   UMD: window.HIGHLIGHT_CORE in the browser, module.exports under Node.
*/
(function (global) {

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var CS_KEYWORDS = "abstract as async await base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach get goto if implicit in init int interface internal is lock long namespace new null object operator out override params partial private protected public readonly record ref required return sbyte sealed set short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using var virtual void volatile when where while yield field value nameof".split(" ");
  var CS_TYPES = "Console Task List Dictionary HashSet SortedSet Queue Stack LinkedList LinkedListNode ObservableCollection IEnumerable IEnumerator ICollection IList IDictionary IComparable IComparer IDisposable INotifyPropertyChanged PropertyChangedEventArgs PropertyChangedEventHandler EventArgs EventHandler Action Func Predicate Thread Tasks Math Random DateTime TimeSpan Guid File Directory Path JsonSerializer JsonSerializerOptions JsonNamingPolicy Exception ArgumentException InvalidOperationException FileNotFoundException NullReferenceException AggregateException OperationCanceledException CancellationToken CancellationTokenSource SemaphoreSlim ManualResetEventSlim PeriodicTimer BlockingCollection ConcurrentBag ConcurrentQueue ConcurrentStack ConcurrentDictionary Interlocked Monitor StringBuilder String Int32 Object Window StackPanel DockPanel Grid Canvas WrapPanel UniformGrid RelativePanel Border Button TextBlock TextBox Label CheckBox RadioButton ComboBox ListBox Slider NumericUpDown Menu MenuItem TabControl TabItem Image Rectangle Ellipse ItemsControl ContentControl UserControl Application AppBuilder Dispatcher DispatcherTimer DispatcherPriority Avalonia ObservableObject RelayCommand IRelayCommand ICommand AsyncRelayCommand Thickness Orientation HorizontalAlignment VerticalAlignment Brushes IBrush SolidColorBrush Color Colors Bitmap AssetLoader IClassicDesktopStyleApplicationLifetime AvaloniaXamlLoader FluentTheme SimpleTheme StreamReader StreamWriter Assert Xunit Fact Theory InlineData AvaloniaFact AvaloniaTestApplication AvaloniaHeadlessPlatformOptions PhysicalKey RawInputModifiers KeyValuePair Enumerable Tuple Lazy Nullable Convert Encoding CultureInfo".split(" ");

  function hiCS(code) {
    var h = esc(code);
    var slots = [];
    var stash = function (html) { slots.push(html); return "~S" + (slots.length - 1) + "Z~"; };

    // comments
    h = h.replace(/\/\*[\s\S]*?\*\//g, function (m) { return stash('<span class="tk-com">' + m + "</span>"); });
    h = h.replace(/\/\/[^\n]*/g, function (m) { return stash('<span class="tk-com">' + m + "</span>"); });
    // strings (interpolated, verbatim, normal, char)
    h = h.replace(/\$?@?&quot;(?:\\.|&quot;&quot;|(?!&quot;)[\s\S])*?&quot;/g, function (m) { return stash('<span class="tk-str">' + m + "</span>"); });
    h = h.replace(/&#39;(?:\\.|[^&])*?&#39;|'(?:\\.|[^'])'/g, function (m) { return stash('<span class="tk-str">' + m + "</span>"); });
    // attributes  [ObservableProperty] [RelayCommand(...)] [Fact] ...
    h = h.replace(/\[(assembly:\s*)?([A-Z]\w*)(\([^\]]*\))?\]/g, function (m) { return stash('<span class="tk-attr">' + m + "</span>"); });
    // numbers  (STASHED: the emitted `class="tk-num"` must stay invisible to the
    // keyword pass below, or it would match the C# keyword `class` inside it)
    h = h.replace(/\b(\d[\d_]*\.?\d*[MmFfDdLl]?)\b/g, function (m) { return stash('<span class="tk-num">' + m + "</span>"); });
    // keywords
    h = h.replace(new RegExp("\\b(" + CS_KEYWORDS.join("|") + ")\\b", "g"), '<span class="tk-kw">$1</span>');
    // known types
    h = h.replace(new RegExp("\\b(" + CS_TYPES.join("|") + ")\\b", "g"), '<span class="tk-typ">$1</span>');

    h = h.replace(/~S(\d+)Z~/g, function (m, i) { return slots[+i]; });
    return h;
  }

  function hiXML(code) {
    var h = esc(code);
    var slots = [];
    var stash = function (html) { slots.push(html); return "~S" + (slots.length - 1) + "Z~"; };

    h = h.replace(/&lt;!--[\s\S]*?--&gt;/g, function (m) { return stash('<span class="tk-com">' + m + "</span>"); });
    // attribute="value"  (highlight {Binding ...} and {x:Type} inside values)
    h = h.replace(/([\w.:-]+)(=)(&quot;[^&]*?&quot;)/g, function (m, n, eq, v) {
      var vv = v.replace(/\{[^}]*\}/g, '<span class="tk-attr">$&</span>');
      return stash('<span class="tk-an">' + n + "</span>" + eq + '<span class="tk-str">' + vv + "</span>");
    });
    // tags
    h = h.replace(/(&lt;\/?)([\w.:]+)/g, '$1<span class="tk-tag">$2</span>');
    h = h.replace(/~S(\d+)Z~/g, function (m, i) { return slots[+i]; });
    return h;
  }

  function hiBash(code) {
    var h = esc(code);
    var slots = [];
    var stash = function (html) { slots.push(html); return "~S" + (slots.length - 1) + "Z~"; };
    // stash comments FIRST so flag/keyword passes never reach inside them
    h = h.replace(/^(\s*#[^\n]*)$/gm, function (m) { return stash('<span class="tk-com">' + m + "</span>"); });
    // commands  (STASHED: the emitted `class="tk-kw"` contains a hyphen, which the
    // flag pass below would otherwise match as a `-kw` flag and corrupt)
    h = h.replace(/^(\s*)(dotnet|cd|mkdir|dir|ls)\b/gm, function (m, sp, kw) { return sp + stash('<span class="tk-kw">' + kw + "</span>"); });
    h = h.replace(/(--?[\w-]+)/g, '<span class="tk-an">$1</span>');
    h = h.replace(/~S(\d+)Z~/g, function (m, i) { return slots[+i]; });
    return h;
  }

  function hiJSON(code) {
    var h = esc(code);
    h = h.replace(/&quot;(\\.|[^&])*?&quot;(?=\s*:)/g, '<span class="tk-an">$&</span>');
    h = h.replace(/:\s*(&quot;(\\.|[^&])*?&quot;)/g, function (m, v) { return m.replace(v, '<span class="tk-str">' + v + "</span>"); });
    h = h.replace(/\b(true|false|null)\b/g, '<span class="tk-kw">$1</span>');
    h = h.replace(/\b(\d+\.?\d*)\b/g, '<span class="tk-num">$1</span>');
    return h;
  }

  function highlight(code, lang) {
    if (lang === "csharp") return hiCS(code);
    if (lang === "xml") return hiXML(code);
    if (lang === "bash") return hiBash(code);
    if (lang === "json") return hiJSON(code);
    return esc(code);
  }

  var API = {
    esc: esc,
    hiCS: hiCS,
    hiXML: hiXML,
    hiBash: hiBash,
    hiJSON: hiJSON,
    highlight: highlight,
  };
  global.HIGHLIGHT_CORE = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;

})(typeof window !== "undefined" ? window : globalThis);
