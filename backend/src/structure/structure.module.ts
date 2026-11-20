import { Module } from '@nestjs/common';
import { RelationLoader } from './relation-loader.js';

@Module({ providers: [RelationLoader], exports: [RelationLoader] })
export class StructureModule {}
