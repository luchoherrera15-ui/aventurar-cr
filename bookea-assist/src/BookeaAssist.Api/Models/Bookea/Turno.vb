Namespace Models.Bookea

    ''' <summary>Un turno (cita/reserva) agendado para un cliente.</summary>
    Public Class Turno

        Public Property Id As String = String.Empty
        Public Property ServicioId As String = String.Empty
        Public Property ServicioNombre As String = String.Empty
        Public Property FechaHora As DateTime
        Public Property ClienteNombre As String = String.Empty
        Public Property ClienteTelefono As String = String.Empty

        ''' <summary>"confirmado", "cancelado" o "reprogramado".</summary>
        Public Property Estado As String = "confirmado"

    End Class

End Namespace
