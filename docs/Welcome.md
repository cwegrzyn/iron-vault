This is the documentation for [Iron Vault](https://github.com/cwegrzyn/iron-vault), a plugin for [Obsidian](https://obsidian.md) that turns the beloved note-taking/journaling tool into a full-fledged Virtual Tabletop (VTT) for the [Ironsworn/Starforged family of games](https://ironswornrpg.com).

It has features ranging from a full character sheet, to commands for making moves, and even an entire featureset for rendering pretty mechanics blocks in your story journals describing the mechanics involved in your story, as they happen.

The plugin is designed to be used piecemeal: you can use as much or as little as you want, and our only hope is that some part of it will be useful enough to make you enjoy your experience a little more.

It is not a "play for me"-style VTT, in the sense that while it has a lot of conveniences for rendering and interacting with mechanics, the actual resolution and logic of game mechanics is left up to you, and whatever flexibility you want to handle the game's rules with. The game, after all, is not a single monolithic set of laws, and everyone tends to take their own liberties with the rules in the interest of enjoying the game more.

You can start reading about the various Iron Vault features here:

* [[Blocks/About|Blocks]] - Special blocks used throughout the tool to render things nicely and give you handy interactive widgets for editing game data.
* [[Commands/About|Commands]] - Various Obsidian commands, all of which can be bound to hotkeys or the quick access bar, for performing all sorts of game actions, like making moves, creating progress tracks, etc.
* [[Entities/About|Entities]] - How Iron Vault represents all sorts of different game concepts, or some ways that you might choose to represent them yourself.
* [[Sidebar]] - A handy right-panel sidebar for quick access to Moves, Oracles, and your Character Sheet, all in one, easy-access place. Particularly useful on mobile.
* [[Special Links]] - There are `oracle:`, `move:`, `asset:` and `id:` links that, instead of trying to open a web page, will instead open a modal window with the contents of the thing you're trying to link to. For example, `[My Oracle](oracle:MyOracleName)` will pop up a window with the description and roll table for "My Oracle".
* [[CSS Tweaks]] - Styling tweaks to make some things look nicer or more customized, such as the `iron-vault-embed` option for inlining embeds.
* [[Settings]] - Various configurations available to tweak your Iron Vault experience.
* [[API]] - (Coming Soon) Are you a developer? We expose the plugin for easy access, for folks who want to do fancier things with Iron Vault features.
* [[Rulesets]] (Coming Soon) - BYO Rulesets! Import custom assets, oracles, or even entire rulesets/games that conform to the [Datasworn](https://github.com/rsek/datasworn) data model.

#### Installing the Plugin

For now, the easiest way to install is via [BRAT](https://tfthacker.com/brat-plugins). 

You should be able to add this repo to BRAT, and it will install the latest release of this plugin, as well as keep it up to date as releases are made.

In the near future, we will be working towards making the plugin directly accessible as a built-in Community Plugin on Obsidian's registry.