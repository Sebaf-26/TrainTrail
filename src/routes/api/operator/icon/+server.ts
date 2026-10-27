import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { hasPermission } from '$lib/server/authorization/authorize';
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE,
  uploadManager,
} from '$lib/server/utils/uploads';

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.authorization) {
    return json({ error: 'Not logged in' }, { status: 401 });
  }

  if (!hasPermission(locals.authorization, 'data.operators.manage')) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (!uploadManager.isReady) {
    return json({ error: 'File uploads are not configured' }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const operatorId = formData.get('operatorId') as string | null;

  if (!file || !operatorId) {
    return json({ error: 'Missing file or operatorId' }, { status: 400 });
  }

  const operatorIdNum = parseInt(operatorId, 10);
  if (isNaN(operatorIdNum)) {
    return json({ error: 'Invalid operatorId' }, { status: 400 });
  }

  const typeIndex = ALLOWED_IMAGE_TYPES.indexOf(file.type);
  if (typeIndex === -1) {
    return json(
      { error: 'Invalid file type. Allowed: PNG, JPG, SVG, WebP' },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return json({ error: 'File too large (max 5MB)' }, { status: 400 });
  }

  // Get file extension from mime type
  const ext = ALLOWED_IMAGE_EXTENSIONS[typeIndex] || '.png';
  const relativePath = `operators/${operatorIdNum}${ext}`;

  // Delete old icon if it exists with a different extension
  const existingOperator = await db
    .selectFrom('operator')
    .select(['iconPath'])
    .where('id', '=', operatorIdNum)
    .executeTakeFirst();

  if (
    existingOperator?.iconPath &&
    existingOperator.iconPath !== relativePath
  ) {
    await uploadManager.deleteFile(existingOperator.iconPath);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const success = await uploadManager.saveFile(relativePath, buffer);

  if (!success) {
    return json({ error: 'Failed to save file' }, { status: 500 });
  }

  // Update operator record with icon path
  await db
    .updateTable('operator')
    .set({ iconPath: relativePath })
    .where('id', '=', operatorIdNum)
    .execute();

  return json({ success: true, path: relativePath });
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
  if (!locals.authorization) {
    return json({ error: 'Not logged in' }, { status: 401 });
  }

  if (!hasPermission(locals.authorization, 'data.operators.manage')) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { operatorId } = await request.json();

  if (!operatorId) {
    return json({ error: 'Missing operatorId' }, { status: 400 });
  }

  // Get current icon path
  const operator = await db
    .selectFrom('operator')
    .select(['iconPath'])
    .where('id', '=', operatorId)
    .executeTakeFirst();

  if (operator?.iconPath) {
    await uploadManager.deleteFile(operator.iconPath);
  }

  // Clear icon path in database
  await db
    .updateTable('operator')
    .set({ iconPath: null })
    .where('id', '=', operatorId)
    .execute();

  return json({ success: true });
};
