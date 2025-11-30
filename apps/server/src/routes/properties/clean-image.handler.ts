import { t, Elysia, form } from 'elysia'
import { Jimp, HorizontalAlign, loadFont } from 'jimp'
import { corePlugin } from '@/plugins'
import path from 'node:path'

const reqDTO = t.Object({
  image: t.File({
    format: 'image',
  }),
})

export const cleanPropertyImageHandler = new Elysia().use(corePlugin).post(
  '/properties/cleanImage',
  async ({ body }) => {
    const { image } = body
    const mimeType = image.type

    const imageBuffer = Buffer.from(await image.arrayBuffer())

    const jimpImage = await Jimp.read(imageBuffer)

    const contrastValue = 0.4
    jimpImage.contrast(contrastValue)

    const font = await loadFont(
      'file://' +
        path.join(
          import.meta.dir,
          'lib/open-sans-32-white/open-sans-32-white.fnt',
        ),
    )
    const text = 'Imagine this is a cleaned photo!'

    const x = 10
    const y = jimpImage.bitmap.height - 50
    const maxWidth = jimpImage.bitmap.width - 20

    jimpImage.print({
      font,
      text: {
        text,
        alignmentX: HorizontalAlign.CENTER,
      },
      x,
      y,
      maxWidth,
    })

    const cleanedImageBuffer = await jimpImage.getBuffer(
      mimeType as 'image/png',
    )

    return form({
      cleanedImage: new Blob([cleanedImageBuffer], {
        type: mimeType,
      }),
    })
  },
  {
    body: reqDTO,
    response: t.Form({
      cleanedImage: t.File({ format: 'image' }),
    }),
  },
)
