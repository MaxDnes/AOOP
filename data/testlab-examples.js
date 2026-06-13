/* ============================================================
   TEST LAB · worked examples gallery
   window.TESTLAB_EXAMPLES = [ { id, name, title, summary, source, notes:[...] }, ... ]

   A small curated set of realistic C# inputs, each chosen to show ONE
   generation pattern clearly. The Test Lab renders these as one-click chips:
   clicking loads `source` into the editor, generates, and shows `notes`,
   a plain-language walk-through of WHY the generated Positive / Negative /
   Edge tests look the way they do.

   Pure data. No DOM. Browser global + Node export so tests can load it and
   feed every `source` through TESTLAB_CORE.parse / generate.
   ============================================================ */

(function (global) {
"use strict";

/* ---- 1. pure methods: return value -> assert, numbers -> [Theory] ---- */
var CALCULATOR = [
  "namespace ExamApp.Services;",
  "",
  "public class Calculator",
  "{",
  "    public int Add(int a, int b) => a + b;",
  "",
  "    public int Divide(int a, int b)",
  "    {",
  "        if (b == 0)",
  "            throw new DivideByZeroException(\"cannot divide by zero\");",
  "        return a / b;",
  "    }",
  "}",
].join("\n");

/* ---- 2. string in, bool out, null guard ---- */
var PASSWORD_POLICY = [
  "using System.Linq;",
  "",
  "namespace ExamApp.Services;",
  "",
  "public class PasswordPolicy",
  "{",
  "    public bool IsStrong(string password)",
  "    {",
  "        if (password is null)",
  "            throw new ArgumentNullException(nameof(password));",
  "        return password.Length >= 8 && password.Any(char.IsDigit);",
  "    }",
  "}",
].join("\n");

/* ---- 3. void methods: assert state, not a return value; exceptions ---- */
var BANK_ACCOUNT = [
  "namespace ExamApp.Services;",
  "",
  "public class BankAccount",
  "{",
  "    public int Balance { get; private set; }",
  "",
  "    public void Deposit(int amount)",
  "    {",
  "        if (amount <= 0)",
  "            throw new ArgumentOutOfRangeException(nameof(amount));",
  "        Balance += amount;",
  "    }",
  "",
  "    public void Withdraw(int amount)",
  "    {",
  "        if (amount > Balance)",
  "            throw new InvalidOperationException(\"insufficient funds\");",
  "        Balance -= amount;",
  "    }",
  "}",
].join("\n");

/* ---- 4. CommunityToolkit ViewModel: commands + observable property ---- */
var COUNTER_VM = [
  "using System.Threading.Tasks;",
  "using CommunityToolkit.Mvvm.ComponentModel;",
  "using CommunityToolkit.Mvvm.Input;",
  "",
  "namespace ExamApp.ViewModels;",
  "",
  "public partial class CounterViewModel : ObservableObject",
  "{",
  "    [ObservableProperty]",
  "    private int count;",
  "",
  "    private bool _running;",
  "",
  "    [RelayCommand]",
  "    private async Task Start()",
  "    {",
  "        _running = true;",
  "        while (_running)",
  "        {",
  "            Count++;",
  "            await Task.Delay(100);",
  "        }",
  "    }",
  "",
  "    [RelayCommand]",
  "    private void Stop() => _running = false;",
  "",
  "    [RelayCommand]",
  "    private void Reset()",
  "    {",
  "        _running = false;",
  "        Count = 0;",
  "    }",
  "}",
].join("\n");

/* ---- 5. async + an injected dependency -> a hand-written fake ---- */
var WEATHER_SERVICE = [
  "using System.Threading.Tasks;",
  "",
  "namespace ExamApp.Services;",
  "",
  "public interface IHttpClient",
  "{",
  "    Task<string> GetAsync(string url);",
  "}",
  "",
  "public class WeatherService",
  "{",
  "    private readonly IHttpClient _http;",
  "",
  "    public WeatherService(IHttpClient http)",
  "    {",
  "        _http = http;",
  "    }",
  "",
  "    public async Task<int> GetTemperatureAsync(string city)",
  "    {",
  "        var raw = await _http.GetAsync(city);",
  "        return int.Parse(raw);",
  "    }",
  "}",
].join("\n");

var TESTLAB_EXAMPLES = [
  {
    id: "calculator",
    name: "Calculator.cs",
    title: "Pure methods",
    summary: "Return value becomes an assert; number arguments become an Edge [Theory].",
    source: CALCULATOR,
    notes: [
      "Both methods return an int, so the Positive test calls the method with valid numbers and checks the answer with Assert.Equal. Swap the 0 placeholder for the value you expect, so Add(2, 3) should assert 5.",
      "Both arguments are numbers, so the Edge test comes out as a [Theory] with [InlineData] rows for 0, 1 and -1. One test method runs three times, once per row, which is how you cover the boundaries without copy-pasting a method.",
      "Divide throws DivideByZeroException when b is 0. That is exactly what the Negative test is for: replace the generated body with Assert.Throws<DivideByZeroException>(() => sut.Divide(1, 0)).",
    ],
  },
  {
    id: "password-policy",
    name: "PasswordPolicy.cs",
    title: "Guard + bool result",
    summary: "A null string argument drives the Negative test; strings get an empty / space / single-char Edge.",
    source: PASSWORD_POLICY,
    notes: [
      "IsStrong returns a bool, so the Positive test asserts Assert.True(result) for a valid password. If your representative case is meant to be rejected, switch it to Assert.False.",
      "password is a non-nullable string, which is a reference type. Passing null breaks the method's contract, so the Negative test is generated as Assert.Throws<ArgumentNullException> with null passed in.",
      "Strings get an Edge [Theory] seeded with the empty string, a single space and one character. Those three inputs are what usually break string logic, so they make the sharpest boundary test.",
    ],
  },
  {
    id: "bank-account",
    name: "BankAccount.cs",
    title: "Void + state + exceptions",
    summary: "No return value, so the test asserts the object's state after the call.",
    source: BANK_ACCOUNT,
    notes: [
      "Deposit and Withdraw return void, so there is nothing to capture from the call. Instead the Positive test checks state afterwards by pointing at the Balance property. Replace the NotNull placeholder with the real expectation: deposit 100, then Assert.Equal(100, sut.Balance).",
      "Withdraw throws InvalidOperationException when you take out more than the balance. Put that in the Negative test as Assert.Throws<InvalidOperationException>(() => sut.Withdraw(1)).",
      "amount is a number, so the Negative test seeds -1 (an out-of-range value the guard should reject) and the Edge [Theory] runs the 0, 1 and -1 boundary rows.",
    ],
  },
  {
    id: "counter-vm",
    name: "CounterViewModel.cs",
    title: "MVVM commands",
    summary: "[RelayCommand] and [ObservableProperty] change what you call and what you assert.",
    source: COUNTER_VM,
    notes: [
      "This is a CommunityToolkit ViewModel. [RelayCommand] on Start generates a StartCommand property behind the scenes, so the test calls vm.StartCommand.Execute(null) rather than the private method directly.",
      "[ObservableProperty] on the count field generates a public Count property. That generated property is what the Positive test reads to confirm a command did its job (for Reset, Count should be 0).",
      "Start runs an async loop, so a second async test file is also generated showing how to await the command and assert without leaning on a real 100 ms timer.",
    ],
  },
  {
    id: "weather-service",
    name: "WeatherService.cs",
    title: "Async + a dependency",
    summary: "A constructor dependency becomes a hand-written fake; Task<T> makes the test async.",
    source: WEATHER_SERVICE,
    notes: [
      "The constructor needs an IHttpClient. A test must not hit the real network, so the generator writes a FakeHttpClient at the bottom of the file and passes that in. That fake is your seam: fill its GetAsync to return whatever the test needs.",
      "GetTemperatureAsync returns Task<int>, so the test method is async Task, the call is awaited, and the Positive assert checks the int with Assert.Equal.",
      "city is a non-nullable string, so the Negative test uses the async form, await Assert.ThrowsAsync<ArgumentNullException>, for the null case.",
    ],
  },
];

global.TESTLAB_EXAMPLES = TESTLAB_EXAMPLES;
if (typeof module !== "undefined" && module.exports) module.exports = TESTLAB_EXAMPLES;

})(typeof window !== "undefined" ? window : globalThis);
