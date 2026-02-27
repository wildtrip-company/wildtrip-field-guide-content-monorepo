import { Injectable } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import { species } from '../../db/schema';
import { eq, desc, ilike, and, or, sql } from 'drizzle-orm';

@Injectable()
export class SpeciesRepository {
  constructor(private dbService: DbService) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    mainGroup?: string;
    status?: string;
  }) {
    const db = this.dbService.getDb();
    const { page = 1, limit = 20, search, mainGroup, status } = params;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions: any[] = [];

    if (status && ['draft', 'published', 'archived'].includes(status)) {
      conditions.push(
        eq(species.status, status as 'draft' | 'published' | 'archived'),
      );
    }

    if (mainGroup) {
      const validGroups = [
        'mammal',
        'bird',
        'reptile',
        'amphibian',
        'fish',
        'insect',
        'arachnid',
        'crustacean',
        'mollusk',
        'plant',
        'fungus',
        'algae',
        'other',
      ];
      if (validGroups.includes(mainGroup)) {
        conditions.push(eq(species.mainGroup, mainGroup as any));
      }
    }

    if (search) {
      conditions.push(
        or(
          ilike(species.commonName, `%${search}%`),
          ilike(species.scientificName, `%${search}%`),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get data with count using window function for better performance
    const query = db
      .select({
        species: species,
        totalCount: sql<number>`count(*) OVER()`,
      })
      .from(species)
      .where(whereClause)
      .orderBy(desc(species.createdAt))
      .limit(limit)
      .offset(offset);

    const results = await query;
    const data = results.map((row) => row.species);
    const count = results.length > 0 ? results[0].totalCount : 0;

    return {
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async findById(id: number, includeDraft: boolean = false) {
    const db = this.dbService.getDb();
    const [result] = await db.select().from(species).where(eq(species.id, id));

    // Log draft data for debugging
    if (result && result.draftData) {
      console.log('Species findById - Draft data:', {
        id,
        hasDraft: result.hasDraft,
        draftData: result.draftData,
        mainImage: result.draftData.mainImage,
        galleryImages: result.draftData.galleryImages,
      });
    }

    // If includeDraft is true and there's draft data, merge it with the published data
    if (includeDraft && result && result.hasDraft && result.draftData) {
      return {
        ...result,
        ...result.draftData,
        isDraft: true,
      };
    }

    return result;
  }

  async findBySlug(slug: string) {
    const db = this.dbService.getDb();
    const [result] = await db
      .select()
      .from(species)
      .where(eq(species.slug, slug));
    return result;
  }

  async create(data: any) {
    const db = this.dbService.getDb();
    const [result] = await db.insert(species).values(data).returning();
    return result;
  }

  async update(id: number, data: any) {
    const db = this.dbService.getDb();
    const [result] = await db
      .update(species)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(species.id, id))
      .returning();
    return result;
  }

  async delete(id: number) {
    const db = this.dbService.getDb();
    await db.delete(species).where(eq(species.id, id));
  }

  async publish(id: number) {
    console.log('Species repository publish called for id:', id);
    const db = this.dbService.getDb();
    const [current] = await db.select().from(species).where(eq(species.id, id));

    console.log('Current species data:', {
      id: current?.id,
      status: current?.status,
      hasDraft: current?.hasDraft,
      draftData: current?.draftData ? 'Has draft data' : 'No draft data',
    });

    if (!current) {
      throw new Error('Species not found');
    }

    // Si hay draft data, publicar el draft
    if (current.draftData) {
      console.log('Publishing with draft data');
      const draftRichContent = current.draftData.richContent as any;
      console.log('Draft data richContent:', {
        hasRichContent: !!draftRichContent,
        richContentType: typeof draftRichContent,
        richContentBlocks: draftRichContent?.blocks?.length || 0,
      });

      // Extract fields from draftData
      const { richContent: draftRichContentField, ...otherDraftFields } =
        current.draftData as any;

      // Explicitly handle richContent to ensure it's properly saved
      // Use draft richContent if it exists, otherwise keep current
      const richContentToSave =
        draftRichContentField !== undefined
          ? draftRichContentField
          : current.richContent;

      // Build update data with explicit field handling
      const updateData: any = {
        // Spread other draft fields
        ...otherDraftFields,
        // Explicitly set richContent (this will override any richContent from spread)
        richContent: richContentToSave,
        // Clear draft-related fields
        draftData: null,
        hasDraft: false,
        draftCreatedAt: null,
        status: 'published' as const,
        publishedAt: new Date(),
        updatedAt: new Date(),
      };

      // Remove undefined fields to avoid overwriting with null
      Object.keys(updateData).forEach((key) => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      console.log('Update data being saved:', {
        hasRichContent: !!updateData.richContent,
        richContentType: typeof updateData.richContent,
        richContentBlocks: updateData.richContent?.blocks?.length || 0,
        allFields: Object.keys(updateData),
      });

      const [result] = await db
        .update(species)
        .set(updateData)
        .where(eq(species.id, id))
        .returning();

      console.log('Published with draft data, result:', {
        status: result.status,
        hasRichContent: !!result.richContent,
        richContentBlocks: result.richContent?.blocks?.length || 0,
      });

      // Verify the data was saved correctly
      const [verification] = await db
        .select()
        .from(species)
        .where(eq(species.id, id));

      console.log('Verification after publish:', {
        hasRichContent: !!verification.richContent,
        richContentBlocks: verification.richContent?.blocks?.length || 0,
      });

      return result;
    }
    // Si no hay draft pero está en borrador, simplemente publicar
    else if (current.status === 'draft') {
      console.log('Publishing draft without draft data');
      const [result] = await db
        .update(species)
        .set({
          status: 'published' as const,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(species.id, id))
        .returning();

      console.log('Published draft, result status:', result.status);
      return result;
    }

    // Si ya está publicado y no hay draft, no hay nada que publicar
    console.log('Nothing to publish - already published without draft');
    throw new Error('Nothing to publish');
  }

  async createDraft(id: number, draftData: any) {
    const db = this.dbService.getDb();
    const [current] = await db.select().from(species).where(eq(species.id, id));

    if (!current) {
      throw new Error('Species not found');
    }

    // Merge with existing draft data (if any) instead of current data
    const existingDraft = current.draftData || {};
    const updatedDraft = {
      ...existingDraft,
      ...draftData,
    };

    // Log what we're saving for debugging
    const draftRichContent = draftData.richContent;
    const updatedRichContent = updatedDraft.richContent;
    console.log('Creating/updating draft with data:', {
      id,
      field: Object.keys(draftData)[0], // Log which field is being updated
      hasRichContent: !!draftRichContent,
      richContentType: typeof draftRichContent,
      richContentBlocks: draftRichContent?.blocks?.length || 0,
      draftRichContent: updatedRichContent?.blocks?.length || 0,
      mainImage: updatedDraft.mainImage,
      galleryImages: updatedDraft.galleryImages,
    });

    const [result] = await db
      .update(species)
      .set({
        draftData: updatedDraft,
        hasDraft: true,
        draftCreatedAt: current.draftCreatedAt || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(species.id, id))
      .returning();

    return result;
  }

  async discardDraft(id: number) {
    const db = this.dbService.getDb();
    const [result] = await db
      .update(species)
      .set({
        draftData: null,
        hasDraft: false,
        draftCreatedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(species.id, id))
      .returning();

    return result;
  }
}
