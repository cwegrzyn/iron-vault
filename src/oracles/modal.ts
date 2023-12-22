import { Oracle, RollContext } from "model/oracle";
import { RollWrapper, type Roll } from "model/rolls";
import { Modal, Setting, type App } from "obsidian";

export class OracleRollerModal extends Modal {
  public accepted: boolean = false;
  public currentRoll: RollWrapper;

  constructor(
    app: App,
    protected rollContext: RollContext,
    protected oracle: Oracle,
    initialRoll: Roll | undefined,
    protected readonly onAccept: (roll: RollWrapper) => void,
    protected readonly onCancel: () => void,
  ) {
    super(app);
    this.currentRoll = new RollWrapper(oracle, rollContext, initialRoll);
  }

  onOpen(): void {
    this.accepted = false;

    const { contentEl } = this;
    contentEl.createEl("h1", { text: this.oracle.name });

    // new Setting(contentEl).addButton((btn) =>
    //   btn
    //     .setButtonText("Accept")
    //     .setCta()
    //     .onClick(() => {
    //       this.accepted = true;
    //       this.close();
    //       this.onAccept(this.currentRoll);
    //     }),
    // );

    const rollSetting = new Setting(contentEl).setName("Current roll");
    const flipSetting = new Setting(contentEl).setName("Flipped roll");

    const render = (roll: RollWrapper): string => {
      const evaledRoll = roll.dehydrate();
      return `${evaledRoll.roll}: ${evaledRoll.results.join("; ")}`;
    };

    const onUpdateRoll = (): void => {
      rollSetting.setDesc(render(this.currentRoll));
      flipSetting.setDesc(render(this.currentRoll.variants["flip"]));
    };

    const setRoll = (roll: RollWrapper): void => {
      this.currentRoll = roll;
      onUpdateRoll();
    };

    rollSetting
      .addExtraButton((btn) =>
        btn.setIcon("refresh-cw").onClick(() => {
          setRoll(this.currentRoll.reroll());
        }),
      )
      .addButton((btn) => {
        btn
          .setButtonText("Select")
          .setCta()
          .onClick(() => {
            this.accept(this.currentRoll);
          });
      });

    flipSetting.addButton((btn) => {
      btn.setButtonText("Select").onClick(() => {
        this.accept(this.currentRoll.variants.flip);
      });
    });

    onUpdateRoll();

    new Setting(contentEl).addButton((button) => {
      button.setButtonText("Cancel").onClick(() => {
        this.close();
      });
    });
  }

  accept(roll: RollWrapper): void {
    this.accepted = true;
    this.close();
    this.onAccept(roll);
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.accepted) {
      this.onCancel();
    }
  }
}
