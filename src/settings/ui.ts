import IronVaultPlugin from "index";
import { PluginSettingTab, Setting, type App } from "obsidian";
import { IronVaultPluginSettings } from "settings";
import { FolderTextSuggest } from "utils/ui/settings/folder";

export class IronVaultSettingTab extends PluginSettingTab {
  plugin: IronVaultPlugin;

  constructor(app: App, plugin: IronVaultPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async updateSetting<K extends keyof IronVaultPluginSettings>(
    key: K,
    value: IronVaultPluginSettings[K],
  ) {
    this.plugin.settings[key] = value;
    await this.plugin.saveSettings();
  }

  display(): void {
    const { containerEl } = this;
    const { settings } = this.plugin;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Oracles folder")
      .setDesc("If specified, load oracles from this folder")
      .addText((text) =>
        text
          .setPlaceholder("Folder name")
          .setValue(settings.oraclesFolder)
          .onChange((value) => this.updateSetting("oraclesFolder", value)),
      );

    new Setting(containerEl)
      .setName("Default progress track folder")
      .setDesc("Create progress tracks in this folder by default.")
      .addSearch((search) => {
        new FolderTextSuggest(this.app, search.inputEl);
        search
          .setPlaceholder("Type the name of a folder")
          .setValue(settings.defaultProgressTrackFolder)
          .onChange((value) =>
            this.updateSetting("defaultProgressTrackFolder", value),
          );
      });

    new Setting(containerEl)
      .setName("Use character system")
      .setDesc(
        "If enabled (default), the plugin will look for an active character when making moves. If disabled, you will be prompted to supply appropriate values when needed.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.useCharacterSystem)
          .onChange((value) => this.updateSetting("useCharacterSystem", value)),
      );

    //--- Mechanics blocks

    new Setting(containerEl).setName("Mechanics blocks").setHeading();

    new Setting(containerEl)
      .setName("Collapse move blocks")
      .setDesc(
        "If enabled (default), moves in mechanics blocks will only show the move name and result by default, and you'll need to click on them to see move details.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.collapseMoves)
          .onChange((value) => this.updateSetting("collapseMoves", value)),
      );

    new Setting(containerEl)
      .setName("Show mechanics toggle")
      .setDesc(
        "If enabled (default), mechanics blocks will show a small 'Hide mechanics' toggle underneath the mechanics items.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(settings.showMechanicsToggle)
          .onChange((value) =>
            this.updateSetting("showMechanicsToggle", value),
          ),
      );
  }
}
