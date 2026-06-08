import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    // 1. Search for the entity on Wikidata
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&format=json`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.search || searchData.search.length === 0) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const entityId = searchData.search[0].id;
    const label = searchData.search[0].label;
    const description = searchData.search[0].description;

    // 2. Fetch the entity claims
    const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=claims&format=json`;
    const entityRes = await fetch(entityUrl);
    const entityData = await entityRes.json();

    const claims = entityData.entities[entityId].claims;

    // Helper to get first string value of a claim
    const getClaimValue = (propId: string) => {
      try {
        if (claims[propId] && claims[propId].length > 0) {
          const value = claims[propId][0].mainsnak.datavalue.value;
          return typeof value === 'string' ? value : null;
        }
      } catch (e) {
        return null;
      }
      return null;
    };

    const logoFile = getClaimValue('P154');
    let logoUrl = null;
    if (logoFile) {
      const crypto = require('crypto');
      const filename = logoFile.replace(/ /g, '_');
      const md5 = crypto.createHash('md5').update(filename).digest('hex');
      logoUrl = `https://upload.wikimedia.org/wikipedia/commons/${md5[0]}/${md5.substring(0, 2)}/${encodeURIComponent(filename)}`;
    }

    const website = getClaimValue('P856');
    const twitter = getClaimValue('P2002');
    const facebook = getClaimValue('P2013');
    const instagram = getClaimValue('P2003');
    const linkedin = getClaimValue('P4264');

    return NextResponse.json({
      id: entityId,
      name: label,
      description,
      logo: logoUrl,
      website,
      social: {
        twitter: twitter ? `https://twitter.com/${twitter}` : null,
        facebook: facebook ? `https://facebook.com/${facebook}` : null,
        instagram: instagram ? `https://instagram.com/${instagram}` : null,
        linkedin: linkedin ? `https://linkedin.com/company/${linkedin}` : null,
      }
    });

  } catch (error: any) {
    console.error('NSI Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
