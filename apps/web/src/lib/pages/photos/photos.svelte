<script lang="ts">
  import { Button } from '~ui/components'
  import { EyeSVG } from '~ui/assets'
  import { mockProperty } from './lib/mock-property'
  import api from '~api'
</script>

<div class=".flex .h-full .items-center .justify-center">
  <Button
    primary
    onClick={() => {
      // display a gallery using data form mockProperty
    }}
  >
    <EyeSVG slot="icon" />
    View gallery
  </Button>
</div>
