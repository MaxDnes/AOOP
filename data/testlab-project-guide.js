/* ============================================================
   TEST LAB · "Create the xUnit test project" walkthrough
   window.TESTLAB_PROJECT_GUIDE = { title, intro, fastPath, steps:[{cmd,note}], gotchas:[...] }

   A single, ordered how-to the Test Lab renders as a collapsible panel, so a
   student who has never made a test project can build one from scratch on exam
   day (offline) and drop the generated files in. Versions match the csproj the
   core emits (data/testlab-core.js PKG). Pure data, no DOM. Browser global +
   Node export.
   ============================================================ */

(function (global) {
"use strict";

var TESTLAB_PROJECT_GUIDE = {
  title: "Create the xUnit test project",
  intro: "A test project is a SECOND project that sits next to the app and references it. " +
    "These are the exact commands; run them from the solution folder (the one that holds the ExamApp folder).",
  fastPath: "Shortcut: the green Export project (.zip) button below does all of this for you — it writes a ready-to-run " +
    "ExamApp.Tests project with your code under Source/ and the generated tests under Tests/. Use these manual steps only " +
    "when you must build the project by hand (e.g. you are adding tests to an existing app project).",
  steps: [
    {
      cmd: "dotnet new xunit -o ExamApp.Tests",
      note: "Creates the test project in a new ExamApp.Tests folder. It comes with xUnit already wired up and a placeholder UnitTest1.cs.",
    },
    {
      cmd: "dotnet sln add ExamApp.Tests",
      note: "Adds it to the solution so the IDE and `dotnet test` see it. Skip this if there is no .sln file.",
    },
    {
      cmd: "dotnet add ExamApp.Tests reference ExamApp",
      note: "THE key step: it lets the test project see the app's classes (the ViewModel/service you are testing). Without it you get CS0246 'type not found'. Point it at the real project folder name if it is not ExamApp.",
    },
    {
      cmd: "dotnet add ExamApp.Tests package Avalonia.Headless.XUnit --version 11.2.1",
      note: "Only needed for headless UI tests ([AvaloniaFact], FindControl, Window.Show()). Plain ViewModel/service tests do NOT need it. Match the version to the app's Avalonia version.",
    },
    {
      cmd: "del ExamApp.Tests\\UnitTest1.cs        (macOS/Linux: rm ExamApp.Tests/UnitTest1.cs)",
      note: "Delete the placeholder test, then paste the files this Lab generated into ExamApp.Tests (and TestAppBuilder.cs + HeadlessUiTests.cs if you use the headless scaffold).",
    },
    {
      cmd: "dotnet test",
      note: "Builds both projects and runs every [Fact]/[Theory]/[AvaloniaFact]. Green = passing. Fill in each // TODO assert, then re-run.",
    },
  ],
  gotchas: [
    "Offline (exam day): a fresh `dotnet new` / `dotnet add package` tries nuget.org. Restore against the local feed instead: dotnet restore --source <local-feed>, and keep every package Version= matching what is already cached (the generated csproj pins them).",
    "Namespaces must line up: the generated tests assume the app namespace is ExamApp (and ViewModels in ExamApp.ViewModels). If your app uses a different namespace, fix the `using` at the top of each generated test, or rename to match.",
    "A constructor with parameters can't be `new`ed with no args: if your ViewModel/service takes dependencies, the generated test passes fakes/defaults — replace them with real or stub instances so the object behaves.",
    "Headless tests need [AvaloniaFact] (not [Fact]) and the [assembly: AvaloniaTestApplication(typeof(TestAppBuilder))] line; a plain [Fact] touching Avalonia throws 'call from invalid thread'.",
  ],
};

global.TESTLAB_PROJECT_GUIDE = TESTLAB_PROJECT_GUIDE;
if (typeof module !== "undefined" && module.exports) module.exports = TESTLAB_PROJECT_GUIDE;

})(typeof window !== "undefined" ? window : globalThis);
