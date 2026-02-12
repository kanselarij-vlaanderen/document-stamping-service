import { numbersBylatinAdverbialNumberals, latinAdverbialNumberals} from './vr-document-name';

export default class VRNotulenName {
  static get regexGroups() {
    return Object.freeze({
      context: '(?<context>(VR)|(VE))',
      year: '(?<year>\\d{4})',
      sessionNr: '(?<sessionNr>\\d{1,2})',
      versionSuffix: `(?<versionSuffix>(${Object.values(latinAdverbialNumberals).map((suffix) => suffix.toUpperCase())
        .join(')|(')}))`.replace('()|', ''), // Hack to get out the value for piece '0'
    });
  }

  static get regex() {
    const regexGroup = VRNotulenName.regexGroups;
    return new RegExp(`^${regexGroup.context} PV ${regexGroup.year}/${regexGroup.sessionNr}${regexGroup.versionSuffix}?$`);
  }

  constructor(name) {
    this.name = name;
  }

  toString() {
    return this.name;
  }

  parseMeta() {
    const match = VRNotulenName.regex.exec(this.name);
    if (!match) {
      throw new Error(`Couldn't parse VR Notulen Name "${this.name}"`);
    }
    const versionSuffix = match.groups.versionSuffix;
    let versionNumber = 1;
    if (versionSuffix) {
      versionNumber = numbersBylatinAdverbialNumberals[versionSuffix.toLowerCase()];
    }
    const meta = {
      context: match.groups.context,
      year: parseInt(match.groups.year, 10),
      sessionNr: parseInt(match.groups.sessionNr, 10),
      versionSuffix,
      versionNumber,
    };
    return meta;
  }

  get isValid() {
    return VRNotulenName.regex.test(this.name);
  }

  vrNumberWithSuffix() {
    try {
      const meta = this.parseMeta();
      return `${meta.context} PV ${meta.year}/${meta.sessionNr}${meta.versionSuffix || ''}`;
    } catch(error) {
      return this.name;
    }
  }
}
