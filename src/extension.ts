import * as vscode from 'vscode'
import { BaseTreeDataProvider } from './utils/src/vscode_feature/sidebar/sidebar_tree_provider'
import { ScriptsType, TreeScriptModel } from './utils/src/vscode_feature/sidebar/sidebar_model'
import { openBrowser } from './utils/src/vscode_utils/vscode_utils'
import { FirebaseDataProvider } from './sidebar/firebase'
import { FlavorMagicDataProvider } from './sidebar/flavor_magic'

export async function activate(context: vscode.ExtensionContext) {
  let sideBars:BaseTreeDataProvider[] = []
  sideBars.push(new FirebaseDataProvider())
  sideBars.push(new FlavorMagicDataProvider())

  for (let sideBar of sideBars) {
    sideBar.registerToVscode(context)
  }
  //註冊命令回調
  const sidebar_command_onselect ="lazy-jack-flutter-firebase-magic.sidebar_command_onselect"
  BaseTreeDataProvider.sidebar_command_onselect =sidebar_command_onselect
  vscode.commands.registerCommand(sidebar_command_onselect, (args) => {
    let dataScript = args as TreeScriptModel
    if (dataScript.scriptsType == ScriptsType.browser) {
      openBrowser(dataScript.script)
      return
    }

    for (let sideBar of sideBars) {
      sideBar.handleCommand(context, dataScript)
    }
  })
}

export function deactivate() { }


