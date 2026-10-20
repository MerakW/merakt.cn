import sharp from 'sharp'

export async function exifFixture() {
  return sharp({create:{width:16,height:16,channels:3,background:'#aaccee'}}).withExif({
    IFD0:{Make:'Canon',Model:'Canon EOS R5',Artist:'Private author'},
    IFD2:{LensModel:'RF 85mm F1.2 L',ExposureTime:'1/250',FNumber:'28/10',FocalLength:'85/1',ISOSpeedRatings:'400',BodySerialNumber:'PRIVATE-SERIAL'},
    IFD3:{GPSLatitudeRef:'N',GPSLatitude:'31/1 12/1 0/1',GPSLongitudeRef:'E',GPSLongitude:'121/1 30/1 0/1'},
  }).jpeg().toBuffer()
}
