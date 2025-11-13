#!/usr/bin/env node
import {buildCli} from '../src/cli';

void buildCli().parseAsync(process.argv);
