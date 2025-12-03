<script lang="ts">
  import { Button } from '~ui/components'
  import { EyeSVG } from '~ui/assets'
  import { mockProperty } from './lib/mock-property'
  import api from '~api'
  import GalleryModal from './gallery-modal.svelte'

  let isGalleryOpen = $state(false)
</script>

<div class=".flex .h-full .items-center .justify-center">
  <Button
    primary
    onClick={() => {
      isGalleryOpen = true
    }}
  >
    <EyeSVG slot="icon" />
    View gallery
  </Button>

  <GalleryModal
    property={mockProperty}
    open={isGalleryOpen}
    onClose={() => (isGalleryOpen = false)}
  />
</div>
