module.exports = {
  extends: ['gitmoji'],
  parserPreset: {
    parserOpts: {
      headerPattern: /^(?:\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]|:\w*:)\s*(\w+)(?:\((\w+)\):)(.*)$/,
      headerCorrespondence: [ 'type', 'scope', 'subject' ]
    }
  }
}
