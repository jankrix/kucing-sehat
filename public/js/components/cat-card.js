import { calculateAge, genderLabel } from '../utils.js';

export function renderCatCard(cat) {
  const age = calculateAge(cat.birth_date);
  const gender = genderLabel(cat.gender);
  const avatarContent = cat.photo_url
    ? `<img src="${cat.photo_url}" alt="${cat.name}">`
    : '🐱';

  return `
    <div class="cat-card" data-cat-id="${cat.id}">
      <div class="cat-avatar">${avatarContent}</div>
      <div class="cat-name">${cat.name}</div>
      <div class="cat-info">${cat.breed || 'Kucing Domestik'} &bull; ${gender}</div>
      <div class="cat-info">${age}</div>
    </div>
  `;
}
