import { runCommand, runTerminal } from "../utils/src/terminal_utils/terminal_utils";
import { ScriptsType, SideBarEntryItem, TreeScriptModel } from "../utils/src/vscode_feature/sidebar/sidebar_model";
import { BaseTreeDataProvider } from "../utils/src/vscode_feature/sidebar/sidebar_tree_provider";
import * as vscode from 'vscode';
import { convertApplicationIdToProjectId, fetchFirebaseFlavor, findFlavors, FirebaseFlavor, Project, syncFireBase } from "./flavor_magic";
import { Icon_Info, Icon_Project, logError } from "../utils/src/logger/logger";
import { openBrowser, showPicker } from "../utils/src/vscode_utils/vscode_utils";
import { getPubspecAsMap } from "../utils/src/language_utils/dart/pubspec/pubspec_utils";
import * as changeCase from "change-case";

const fireBaseUninstallScripts: TreeScriptModel[] = [
    {
        scriptsType: ScriptsType.terminal,
        label: 'firebase install',
        script: 'brew install firebase-cli',

    }
]

const fireBaseInstallScripts: TreeScriptModel[] = [
    {
        scriptsType: ScriptsType.command,
        label: 'Open Firebase Console',
        script: 'Open Firebase Console',
    },
    {
        scriptsType: ScriptsType.command,
        label: 'Switch user',
        script: 'firebase login:list',
    },

    {
        scriptsType: ScriptsType.terminal,
        label: 'Project list',
        script: 'firebase projects:list',
    },
    {
        scriptsType: ScriptsType.terminal,
        label: 'Login',
        script: 'firebase login',
    },
    {
        scriptsType: ScriptsType.terminal,
        label: 'Start firebase emulators',
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
                if ("Open Firebase Console" === cmd) {
                    this.openFireBase()
                } else {
                    runTerminal('firebase logout')
                    runTerminal(`firebase  login`, '', true)
                }

            }
        }
    }

    async openFireBase() {

        let text = await syncFireBase()
        let rows = text.match(/\│\s*(.*?)\s*\│\s*(.*?)\s*\│\s*(.*?)\s*\│\s*(.*?)\s*\│/g)!
        let projects: Project[] = []
        for (let r of rows) {
            let items = r.match(/\│\s*(.*?)\s*\│\s*(.*?)\s*\│\s*(.*?)\s*\│/g)![0].split('│').filter((i) => i != '').map((i) => i.trim())
            if (items[0].includes('Display Name')) continue
            let project: Project = new Project()
            project.projectDisplayName = items[0]
            project.projectID = items[1]
            project.projectNumber = items[2]
            projects.push(project)
        }
        let projectsItems: { label: string; id: string; }[] = []
        projectsItems = projects.map((p) => { return { label: `${Icon_Project} ${p.projectDisplayName}`, id: p.projectID } })
        let yaml = await getPubspecAsMap()
        let packageName = yaml!['name']
        let target = changeCase.camelCase(packageName)
        let picker: { label: string; description: string; projectID: string }[] = [];
        let firebaseFlavor: FirebaseFlavor[] = await findFlavors()
        picker = projectsItems
            .map((e) => ({
                label: e.label,
                description: e.id,
                projectID: e.id,
            }));
        picker = [...[{
            label: `${Icon_Project} Console`,
            description: "Console",
            projectID: "Console",
        }], ...picker,]
        // let createAbleFlavorItem: { label: string; description: string; firebaseFlavor: FirebaseFlavor,projectID:string }[] = []

        // for (let f of firebaseFlavors) {
        //     createAbleFlavorItem.push({ label: f.flavorName, description: `appName: ${f.displayName} , id : ${f.applicationId} `, firebaseFlavor: f })
        // }

        showPicker(`${Icon_Info} Select flavor to set firebase`, picker, async (item) => {
            if (item == undefined)
                return;
            if (item.projectID === "Console") {
                openBrowser(`https://console.firebase.google.com/u/0/`)
            } else {
                openBrowser(`https://console.firebase.google.com/u/0/project/${item.projectID}/overview`)
            }


        }
        )
    }

}

