import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { listBenefits } from '../../../api/benefitApi'
import type { Benefit } from '../../../types/benefits'

export function BenefitListPage() {
  const navigate = useNavigate()
  const [benefits, setBenefits] = useState<Benefit[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listBenefits()
      .then(setBenefits)
      .catch((err) => setError(extractErrorMessage(err, 'Льготаларды жүктеу сәтсіз аяқталды')))
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Льготалар</h1>
        <Button onClick={() => navigate('/admin/benefits/new')}>Жаңа льгота</Button>
      </div>

      {error && <Alert variant="error" message={error} />}
      {!error && !benefits && <p className="text-sm text-gray-500">Жүктелуде...</p>}

      <div className="flex flex-col gap-3">
        {benefits?.map((b) => (
          <Card
            key={b.id}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => navigate(`/admin/benefits/${b.id}/edit`)}
          >
            <p className="font-medium text-gray-900">{b.name}</p>
            <p className="text-sm text-gray-500">{b.description}</p>
          </Card>
        ))}
        {benefits && benefits.length === 0 && (
          <p className="text-sm text-gray-500">Льгота жоқ</p>
        )}
      </div>
    </div>
  )
}
