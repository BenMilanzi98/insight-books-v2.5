import { register } from 'node:module';

register('./nodeAliasLoader.mjs', import.meta.url);
