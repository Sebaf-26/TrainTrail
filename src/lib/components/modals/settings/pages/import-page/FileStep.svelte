<script lang="ts">
  import { Upload } from '@o7/icon/lucide';
  import { Card } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/input';
  import type { Platform } from '$lib/import/platforms';
  import { cn } from '$lib/utils';

  let {
    platform,
    files = $bindable(null),
    pastedText = $bindable(''),
    fileError = null,
    validateFile,
    canNext = false,
    onback,
    onnext,
  }: {
    platform: Platform;
    files?: FileList | null;
    pastedText?: string;
    fileError?: string | null;
    validateFile: () => void;
    canNext?: boolean;
    onback?: () => void;
    onnext?: () => void;
  } = $props();

  const acceptsText = $derived(platform.value === 'ticket');
  const extensions = $derived(platform.extensions.join(', '));
</script>

{#if acceptsText}
  <div class="space-y-2">
    <h3 class="text-sm font-medium">Paste the ticket</h3>
    <Textarea
      bind:value={pastedText}
      rows={6}
      placeholder="Paste the message or e-mail you received, or the link to add the ticket to Google Wallet"
      aria-label="Ticket text"
    />
    <p class="text-xs text-muted-foreground">
      Or choose a file below. A chosen file is used instead of the pasted text.
    </p>
  </div>
{/if}
<div class={cn('space-y-2', { 'mt-4': acceptsText })}>
  <h3 class="text-sm font-medium">Upload file</h3>
  <label for="file" class="block">
    <Card
      class={cn(
        'cursor-pointer py-12 border-2 border-dashed flex flex-col items-center hover:bg-card-hover dark:hover:bg-dark-2',
        { 'border-destructive': fileError },
      )}
    >
      <Upload />
      {#if fileError}
        {fileError}
      {:else}
        {files?.[0]?.name ?? 'Upload file'}
      {/if}
    </Card>
  </label>
  <p class="text-xs text-muted-foreground">Supported: {extensions}. Max 5MB.</p>
</div>
<input
  onchange={validateFile}
  id="file"
  name="file"
  type="file"
  accept={platform.extensions.join(',')}
  bind:files
  class="hidden"
/>
<div class="mt-4 flex justify-between">
  <Button variant="secondary" onclick={() => onback?.()}>Back</Button>
  <Button onclick={() => onnext?.()} disabled={!canNext}>Next</Button>
</div>
