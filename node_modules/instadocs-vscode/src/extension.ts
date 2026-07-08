import * as vscode from 'vscode';
import { openGeneratePanel } from './panel';
import { openWelcome, maybeShowWelcomeOnStartup } from './welcome';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    // Main UI: a single panel for source + gateway config + generate + saved path.
    // This is the whole workflow — folder OR git URL, gateway override, output.
    vscode.commands.registerCommand('instadocs.openPanel', (uri?: vscode.Uri) =>
      openGeneratePanel(context, uri?.fsPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath)
    ),
    // Branded welcome / get-started page.
    vscode.commands.registerCommand('instadocs.welcome', () => openWelcome(context))
  );

  // Show the welcome page on startup (until the user turns it off).
  maybeShowWelcomeOnStartup(context);
}

export function deactivate(): void {
  /* nothing to clean up */
}
