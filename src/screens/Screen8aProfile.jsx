import { useState, useContext } from 'react'
import s from './Screen8aProfile.module.css'
import TopBar from './TopBar.jsx'
import Sidebar from './Sidebar.jsx'
import { NavContext } from './NavContext.js'
import { CopyIcon, PlusIcon, HelpIcon } from './icons.jsx'
import { useChannel } from '../storage/useChannel.js'

const TABS = ['Профиль', 'Вкладка "Главная"']
const DEFAULT_AVATAR = '/studio-assets/trading-avatar.svg'
const LogoPlayer = () => <div className={s.logoGenerated}>TI</div>
const BannerArt = ({ name }) => <div className={s.bannerGenerated}>{name}</div>

export default function Screen8aProfile() {
  const { go, showToast } = useContext(NavContext)
  const { channel, update: updateChannel } = useChannel()
  const [activeTab, setActiveTab] = useState(0)
  const avatarUrl = channel.avatar || DEFAULT_AVATAR
  return (
    <div className={s.page}>
      <TopBar/>
      <Sidebar active="channel"/>
      <div className={s.main}>
        <div className={s.headerRow}>
          <h1 className={s.title}>Настройка канала</h1>
          <div className={s.actionsRight}>
            <button type="button" className={s.linkBtn}>Посмотреть на канале</button>
            <button type="button" className={s.cancel}>Отмена</button>
            <button type="button" className={s.publish}>Опубликовать</button>
          </div>
        </div>
        <div className={s.tabs}>
          {TABS.map((t, i) => (
            <button
              key={t}
              type="button"
              className={`${s.tab} ${i === activeTab ? s.tabActive : ''}`}
              onClick={() => {
                setActiveTab(i)
                if (i === 1) go('channel-home')
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Баннер</div>
          <div className={s.sectionDesc}>Это изображение показывается в верхней части страницы канала.</div>
          <div className={s.row}>
            <div className={s.bannerPreview}><BannerArt name={channel.channelName}/></div>
            <div>
              <div className={s.helperText}>Чтобы баннер выглядел оптимально на всех устройствах, используйте изображение размером не менее 2048 x 1152 пикс. Размер файла — не более 6 МБ.</div>
              <button type="button" className={s.uploadBtn} onClick={() => showToast('Изменить баннер')}>Изменить</button>
            </div>
          </div>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Фото профиля</div>
          <div className={s.sectionDesc}>Это изображение показывается рядом с вашими видео и комментариями на YouTube.</div>
          <div className={s.row}>
            <div
              className={s.profilePreview}
              style={{ backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
            <div>
              <div className={s.helperTextWide}>Рекомендуемое разрешение изображения — не менее 98 x 98 пикселей в формате PNG или GIF. Анимированные изображения не поддерживаются. Размер файла — не более 4 МБ.</div>
              <div className={s.inlineActionRow}>
                <button type="button" className={s.uploadBtn}>Изменить</button>
                <button type="button" className={s.uploadBtn}>Удалить</button>
              </div>
            </div>
          </div>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Название канала</div>
          <div className={s.sectionDesc}>Укажите название канала, которое будет отображаться для зрителей. Его можно менять не чаще двух раз в 14 дней.</div>
          <input
            className={s.input}
            value={channel.channelName}
            onChange={(e) => updateChannel({ channelName: e.target.value })}
          />
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Псевдоним</div>
          <div className={s.sectionDesc}>Уникальное имя с символом @, по которому зрители смогут найти ваш канал.</div>
          <input className={s.input} defaultValue="@inside-trading"/>
          <div className={s.urlBelow}>https://www.youtube.com/@inside-trading</div>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Описание канала</div>
          <textarea className={s.textarea} defaultValue="Разборы сделок, риск-менеджмент и дневник дохода от трейдинга."/>
          <button type="button" className={s.addPill}><PlusIcon size={14}/>Добавить перевод</button>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>URL канала</div>
          <div className={s.sectionDesc}>Это стандартный веб-адрес вашего канала. <HelpIcon size={14}/></div>
          <div className={s.inputWithIcon}>
            <input defaultValue="https://www.youtube.com/channel/UCXD2tlKjAr6Ji7JY6Wk3iwA" readOnly/>
            <button type="button" className={s.copyIcon} aria-label="Скопировать"><CopyIcon/></button>
          </div>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Ссылки</div>
          <div className={s.sectionDesc}>Добавьте ссылки на сайты и соцсети. Они могут появляться в разделе "О канале".</div>
          <button type="button" className={s.addPill}><PlusIcon size={14}/>Добавить ссылку</button>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Контактная информация</div>
          <div className={s.sectionDesc}>Укажите адрес электронной почты для деловых запросов.</div>
          <div className={s.emailField}><span className={s.emailLabel}>Электронная почта</span>Адрес электронной почты</div>
        </div>

        <div className={s.section}>
          <div className={s.sectionTitle}>Водяной знак</div>
          <div className={s.sectionDesc}>Загрузите водяной знак, который будет показываться в правом нижнем углу ваших видео.</div>
          <div className={s.row}>
            <div className={s.logoPreview}><LogoPlayer/></div>
            <div><div className={s.helperText}>Рекомендуемый размер изображения — 150 x 150 пикселей в формате PNG, GIF, BMP или JPEG. Размер файла — не более 1 МБ.</div><button type="button" className={s.uploadBtn}>Изменить</button></div>
          </div>
        </div>
      </div>
    </div>
  )
}
