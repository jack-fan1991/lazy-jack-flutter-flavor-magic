import { runCommand, runTerminal } from "../utils/src/terminal_utils/terminal_utils";
import { ScriptsType, SideBarEntryItem, TreeScriptModel } from "../utils/src/vscode_feature/sidebar/sidebar_model";
import { BaseTreeDataProvider } from "../utils/src/vscode_feature/sidebar/sidebar_tree_provider";
import * as vscode from 'vscode';
const fireBaseUninstallScripts: TreeScriptModel[] = [
    {
        scriptsType: ScriptsType.terminal,
        label: 'firebase install',
        script: 'npm install -g firebase-tools',

    }
]

const fireBaseInstallScripts: TreeScriptModel[] = [
    {
        scriptsType: ScriptsType.browser,
        label: 'Open Firebase Console',
        script: 'https://console.firebase.google.com/',
    },
    {
        scriptsType: ScriptsType.command,
        label: 'Switch user',
        script: 'firebase login:list',
    },

    {
        scriptsType: ScriptsType.terminal,
        label: 'Projects',
        script: 'firebase projects:list',
    },
    {
        scriptsType: ScriptsType.terminal,
        label: 'Login',
        script: 'firebase login',
    },
    {
        scriptsType: ScriptsType.terminal,
        label: 'Start emulators',
        script: 'firebase emulators:start',
    }


]

export class FirebaseDataProvider extends BaseTreeDataProvider {
    supportScripts(): TreeScriptModel[] {
        return [...fireBaseUninstallScripts, ...fireBaseInstallScripts];

    }
    viewsId(): string {
        return "FirebaseDataProvider"
    }
    getChildren(
        element?: SideBarEntryItem
    ): vscode.ProviderResult<SideBarEntryItem[]> {
        return Promise.resolve(this.firebaseTree(),);
    }

    private async firebaseTree(): Promise<SideBarEntryItem[]> {
        let childrenList: SideBarEntryItem[] = []
        // try {
        //     await runCommand("firebase --version")
        // }
        // catch {
        //     return FirebaseDataProvider.parseScripts(fireBaseUninstallScripts);

        // }
        return FirebaseDataProvider.parseScripts(fireBaseInstallScripts);

    }

    async handleCommand(context: vscode.ExtensionContext, script: TreeScriptModel): Promise<void> {
        let allScripts = this.supportScripts().map((item) => { return item.script })
        let cmd: string = script.script
        if (allScripts.includes(cmd)) {
            if (script.scriptsType == ScriptsType.terminal) {
                runTerminal(cmd)
            } else if (script.scriptsType == ScriptsType.command) {
                runTerminal('firebase logout')
                runTerminal(`firebase  login`, '', true)
            }
        }
    }
}

